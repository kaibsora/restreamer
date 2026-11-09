import React from 'react';

import { Trans } from '@lingui/react/macro';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

// Import all filters (audio/video)
import * as Filters from './filters';

// Import all encoders (audio/video)
import * as Encoders from './coders/Encoders';
import { withDefaults } from '../utils/props';

export default function FilterSelect(inputProps) {
	const props = withDefaults(inputProps, FilterSelectDefaultProps);
	const profile = props.profile;

	// handleFilterChange
	// what: Filter name
	// settings (component settings):  {Key: Value}
	// mapping (FFmpeg -af/-vf args): ['String', ...]
	const handleFilterSettingsChange = (what) => (settings, graph, automatic) => {
		const filter = profile.filter;

		// Store mapping/settings per component
		filter.settings[what] = {
			settings: settings,
			graph: graph,
		};

		// Get the order of the filters
		let filterOrder = [];
		if (props.type === 'video') {
			filterOrder = Filters.Video.Filters();
		} else {
			filterOrder = Filters.Audio.Filters();
		}

		// Create the filter graph in the order as the filters are registered
		const graphs = [];
		for (let f of filterOrder) {
			if (!(f in filter.settings)) {
				continue;
			}

			if (filter.settings[f].graph.length !== 0) {
				graphs.push(filter.settings[f].graph);
			}
		}

		filter.graph = graphs.join(',');

		props.onChange(filter, automatic);
	};

	// Set filterRegistry by type
	let filterRegistry = null;
	if (props.type === 'video') {
		filterRegistry = Filters.Video;
	} else if (props.type === 'audio') {
		filterRegistry = Filters.Audio;
	} else {
		return null;
	}

	// Checks the state of hwaccel (gpu encoding)
	let hwaccel = false;
	if (props.type === 'video') {
		const encoder = Encoders.Video.Get(props.profile.encoder.coder);
		hwaccel = encoder?.hwaccel === true;
	}

	// Creates filter components
	const filterSettings = [];
	for (let c of filterRegistry.List()) {
		if (hwaccel && c.hwaccel !== true) {
			continue;
		}

		const requiredFilters = c.filters || [c.filter];
		// Checks FFmpeg skills (all filters used by this component are available)
		if (requiredFilters.every((filter) => props.availableFilters.includes(filter))) {
			const Settings = c.component;

			if (!(c.filter in profile.filter.settings)) {
				profile.filter.settings[c.filter] = c.defaults();
			} else {
				profile.filter.settings[c.filter] = {
					...c.defaults(),
					...profile.filter.settings[c.filter],
				};
			}

			filterSettings.push(
				<Settings
					key={c.filter}
					settings={profile.filter.settings[c.filter].settings}
					profile={profile}
					onStore={props.onStore}
					onChange={handleFilterSettingsChange(c.filter)}
				/>,
			);
		}
	}

	// No suitable filter found
	if (filterSettings.length === 0) {
		return (
			<Grid container spacing={2}>
				<Grid item xs={12}>
					<Typography>
						<Trans>No suitable filter found.</Trans>
					</Typography>
				</Grid>
			</Grid>
		);
	}

	return (
		<Grid container spacing={2}>
			<Grid item xs={12}>
				<Typography>
					<Trans>Select your filter settings (optional):</Trans>
				</Typography>
			</Grid>
			{filterSettings}
		</Grid>
	);
}

const FilterSelectDefaultProps = {
	type: '',
	profile: {},
	availableFilters: [],
	onStore: async function () {
		return '';
	},
	onChange: function (filter, automatic) {},
};
