#!/usr/bin/env python3
"""Synchronize only V4L2 capture nodes into a named Docker container."""
import argparse
import fcntl
import glob
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile


def checked_path(path):
    if not re.fullmatch(r'/dev/video[0-9]+|/dev/v4l/by-id/[A-Za-z0-9_.:+-]+', path):
        raise ValueError('Refusing unmanaged device path: ' + path)
    return path


def plan(previous, current):
    commands = []
    for name in previous.get('links', {}):
        if name not in current['links']:
            commands.append(['rm', '-f', '--', checked_path('/dev/v4l/by-id/' + name)])
    for name in previous.get('devices', {}):
        if name not in current['devices']:
            commands.append(['rm', '-f', '--', checked_path('/dev/' + name)])
    for name, node in current['devices'].items():
        path = checked_path('/dev/' + name)
        if node['major'] != 81 or node['minor'] < 0 or node['gid'] < 0:
            raise ValueError('Only V4L2 character devices (major 81) are allowed')
        if previous.get('devices', {}).get(name) != node:
            if name in previous.get('devices', {}):
                commands.append(['rm', '-f', '--', path])
            # Never replace an existing non-device path or a bind-mounted node.
            commands.append(['sh', '-c', 'test -c "$1" || mknod -m 660 "$1" c 81 "$2"',
                             'video-hotplug', path, str(node['minor'])])
            commands.append(['chown', '0:' + str(node['gid']), path])
    if current['links'] and current['links'] != previous.get('links', {}):
        commands.append(['mkdir', '-p', '/dev/v4l/by-id'])
    for name, target in current['links'].items():
        path = checked_path('/dev/v4l/by-id/' + name)
        checked_path('/dev/' + target)
        if target not in current['devices']:
            raise ValueError('Camera alias points outside the synchronized devices')
        if previous.get('links', {}).get(name) != target:
            commands.append(['ln', '-sfn', '../../' + target, path])
    return commands


def discover():
    result = {'devices': {}, 'links': {}}
    for path in sorted(glob.glob('/dev/video[0-9]*')):
        if not re.fullmatch(r'/dev/video[0-9]+', path):
            continue
        try:
            info = os.stat(path)
            props = subprocess.check_output(['udevadm', 'info', '--query=property', '--name=' + path], text=True)
        except (OSError, subprocess.CalledProcessError):
            continue  # A device can disappear while udev is handling its event.
        caps = next((p.partition('=')[2] for p in props.splitlines() if p.startswith('ID_V4L_CAPABILITIES=')), '')
        if not stat.S_ISCHR(info.st_mode) or os.major(info.st_rdev) != 81 or ':capture:' not in caps:
            continue
        result['devices'][Path(path).name] = {'major': 81, 'minor': os.minor(info.st_rdev), 'gid': info.st_gid}
    for path in sorted(glob.glob('/dev/v4l/by-id/*')):
        target = Path(os.path.realpath(path)).name
        if target in result['devices']:
            checked_path(path)
            result['links'][Path(path).name] = target
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--container', default='restreamer')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', args.container):
        parser.error('Invalid container name')
    if not args.dry_run and os.geteuid() != 0:
        parser.error('Run as root on the Docker host')
    inspection = subprocess.run(['docker', 'inspect', '--format', '{{.Id}} {{.State.StartedAt}} {{.State.Running}}', args.container],
                                capture_output=True, text=True)
    if inspection.returncode != 0 or not inspection.stdout.strip().endswith(' true'):
        return  # The timer will retry after the container starts or is recreated.
    container_id = inspection.stdout.split()[0]
    started_at = inspection.stdout.split()[1]
    if args.dry_run:
        current = discover()
        print(json.dumps({'container': container_id, 'devices': current, 'commands': plan({}, current)}, indent=2))
        return
    directory = Path('/run/restreamer-video-hotplug')
    directory.mkdir(mode=0o700, exist_ok=True)
    with (directory / (args.container + '.lock')).open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        current = discover()
        statefile = directory / (args.container + '.json')
        previous = json.loads(statefile.read_text()) if statefile.exists() else {}
        if previous.get('container') != container_id or previous.get('started_at') != started_at:
            previous = {}
        commands = plan(previous, current)
        for command in commands:
            subprocess.run(['docker', 'exec', '--user', '0', args.container] + command, check=True)
        current['container'] = container_id
        current['started_at'] = started_at
        with tempfile.NamedTemporaryFile(mode='w', dir=directory, delete=False) as output:
            json.dump(current, output)
            temporary = output.name
        os.replace(temporary, statefile)
        if commands:
            print('Synchronized %d capture devices into %s' % (len(current['devices']), args.container))


if __name__ == '__main__':
    main()
