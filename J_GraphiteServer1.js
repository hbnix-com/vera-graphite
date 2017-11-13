var GRAPHITE_DEVICE = 'urn:graphite-server-com:device:GraphiteServer:1';
var GRAPHITE_SERVICE = 'urn:graphite-server-com:serviceId:GraphiteServer1';
var GRAPHITE_METRICS_VAR = 'Devices';
var GRAPHITE_VALUE_TYPES = {
	0 : '',
	'b' : 'Battery',
	'h' : 'Humidity',
	'g' : 'Generic',
	'l' : 'Light',
	'pw' : 'Power',
	'ps' : 'Power Status',
	'pr' : 'Pressure',
	'r' : 'Rain',
	'rt' : 'Rain total',
	'sw' : 'Scale weight',
	'si' : 'Scale impedance',
	't' : 'Temperature',
	'uv' : 'Uv',
	'wg' : 'Wind gust',
	'wa' : 'Wind avg'
};

/**
 * Add a metric
 * 
 * @param graphiteDevId
 * @param devId
 * @param metric
 * @param path
 */
function add_metric(graphiteDevId, addButton) {

	var htmlRow = $(addButton).parents('tr');
	var devId = Number(htmlRow.find('select[name="dev_num"]').val());
	var metric = htmlRow.find('select[name="metric_type"]').val();
	var path = htmlRow.find('input[name="graphite_path"]').val();

	if (!devId || !metric || !path) {
		return;
	}

	// Upnp var
	var metrics = get_metrics_settings(graphiteDevId);
	if (!metrics.hasOwnProperty(devId)) {
		metrics[devId] = {};
	}
	metrics[devId][metric] = path;
	set_metrics_settings(graphiteDevId, metrics);

	// add an HTML row and change current row
	htmlRow.replaceWith(build_metric_row(graphiteDevId, devId, metric, path));
	$('#graphite_metrics').append(
			build_metric_row(graphiteDevId, '', '', '', 'add'));
}

/**
 * Remove a metric
 * 
 * @param graphiteDevId
 * @param devId
 * @param metric
 */
function remove_metric(graphiteDevId, remButton) {

	var htmlRow = $(remButton).parents('tr');
	var devId = htmlRow.children().get(0).innerHTML;
	var metric = htmlRow.children().get(1).innerHTML;

	// Real values
	for ( var i = 0, len = jsonp.ud.devices.length; i < len; i++) {
		if (jsonp.ud.devices[i].name == devId) {
			devId = Number(jsonp.ud.devices[i].id);
			break;
		}
	}
	for (key in GRAPHITE_VALUE_TYPES) {
		if (GRAPHITE_VALUE_TYPES[key] == metric) {
			metric = key;
			break;
		}
	}

	// Upnp var
	var metrics = get_metrics_settings(graphiteDevId);
	delete metrics[devId][metric];
	if (Object.keys(metrics[devId]).length == 0) {
		delete metrics[devId];
	}
	set_metrics_settings(graphiteDevId, metrics);

	// Remove HTML row
	htmlRow.remove();
}

/**
 * Parse the 'Metrics' UPNP state variable of the Graphite device
 * 
 * @param devId
 *            ID of the Graphite device
 * @returns {Object}
 */
function get_metrics_settings(devId) {
	var metricsUpnp = get_device_state(devId, GRAPHITE_SERVICE,
			GRAPHITE_METRICS_VAR);

	if (metricsUpnp == "") {
		return {};
	}

	var metrics = {};

	var re1 = /(\d+)=([\w:\.,]+);?/g;
	var re2 = /([thpb]):([\w\.]+),?/g;
	var devices, params;

	while ((devices = re1.exec(metricsUpnp)) !== null) {
		metrics[devices[1]] = {};
		while ((params = re2.exec(devices[2])) !== null) {
			metrics[devices[1]][params[1]] = params[2];
		}
	}

	return metrics;
}

/**
 * Build and set the 'Metrics' UPNP state variable of the Graphite device
 * 
 * @param devId
 *            ID of the Graphite device
 * @param metrics
 *            {Object}
 */
function set_metrics_settings(devId, metrics) {
	var devicesArray = [];
	var metricsArray;

	for (device in metrics) {
		metricsArray = [];

		for (metric in metrics[device]) {
			metricsArray.push(metric + ':' + metrics[device][metric]);
		}

		devicesArray.push(device + '=' + metricsArray.join(','));
	}

	set_device_state(devId, GRAPHITE_SERVICE, GRAPHITE_METRICS_VAR,
			devicesArray.join(';'));
}

/**
 * Build a form row for a metric
 * 
 * @param graphiteDevId
 * @param devId
 * @param metric
 * @param path
 * @param type
 * @returns {String}
 */
function build_metric_row(graphiteDevId, devId, metric, path, type) {
	var html = '';

	html += '<tr>';

	// Input row
	if (type == 'add') {

		// device <select>
		html += '<td width="100">';
		html += '<select name="dev_num" style="width:150px;">';

		var devices_list = get_devices_list_by_rooms();
		for (room in devices_list) {
			html += '<optgroup label="' + room + '">';
			for (dev in devices_list[room]) {
				html += '<option value="' + dev + '">'
						+ devices_list[room][dev] + ' (' + dev + ')</option>';
			}

			html += '</optgroup>';
		}

		html += '</select>';
		html += '</td>';

		// value type <select>
		html += '<td>';
		html += '<select name="metric_type">';

		var type;
		for (type in GRAPHITE_VALUE_TYPES) {
			html += '<option value="' + type + '">'
					+ GRAPHITE_VALUE_TYPES[type] + '</option>';
		}

		html += '</select>';
		html += '</td>';

		// graphite path text <input>
		html += '<td><input type="text" name="graphite_path" value="' + path
				+ '" /></td>';

		// add button
		html += '<td><input type="button" class="btn" value="Add" onClick="add_metric('
				+ graphiteDevId + ',this);" /></td>';
	}

	// Display/Remove row
	else {
		var deviceObj = get_device_obj(devId);

		html += '<td width="100">' + deviceObj.name + '</td>';
		html += '<td>' + GRAPHITE_VALUE_TYPES[metric] + '</td>';
		html += '<td>' + path + '</td>';
		html += '<td><input type="button" class="btn" value="Remove" onClick="remove_metric('
				+ graphiteDevId + ',this);" /></td>';
	}

	html += '</tr>';

	return html;
}

/**
 * Build a list of rooms with devices ids/names inside
 * 
 * @returns {Object}
 */
function get_devices_list_by_rooms() {
	var list = {}, room, device;

	function find_room_name(id) {
		for ( var i = 0, len = jsonp.ud.rooms.length; i < len; i++) {
			if (jsonp.ud.rooms[i].id == id) {
				return jsonp.ud.rooms[i].name;
			}
		}

		return false;
	}

	for ( var i = 0, len = jsonp.ud.devices.length; i < len; i++) {
		device = jsonp.ud.devices[i];
		if (!device.hasOwnProperty('room')
				|| (room = find_room_name(device.room)) === false) {
			room = 'no room';
		}

		if (!list.hasOwnProperty(room)) {
			list[room] = {};
		}

		list[room][device.id] = device.name;
	}

	return list;
}

/**
 * Build the Graphite server 'settings' tab
 * 
 * @param graphiteDevId
 */
function graphite_server_settings(graphiteDevId) {
	var html = '';
	var deviceObj = get_device_obj(graphiteDevId);
	var devicePos = get_device_index(graphiteDevId);

	/*
	 * Usage
	 */
	html += '<p style="text-align:center;font-weight:bold;">'
			+ 'The graphite path/target is built like this : '
			+ 'prefix(.room_name).graphite_path</p>';

	/*
	 * Configs
	 */
	html += '<table width="100%" border="0" class="skinned-form-controls skinned-form-controls-mac">';

	var settingsArray = new Array('Host', 'Port', 'Prefix', 'Interval');

	var i = 0, varName, varValue;
	for (; i < settingsArray.length; i++) {

		varName = settingsArray[i];
		varValue = get_device_state(graphiteDevId, GRAPHITE_SERVICE, varName);

		html += '<tr>';
		html += '<td width="100">' + varName + '</td>';
		html += '<td ><input type="text" id="graphite_state_' + graphiteDevId
				+ '_' + i + '" value="' + varValue
				+ '" onChange="set_device_state(' + graphiteDevId + ',\''
				+ GRAPHITE_SERVICE + '\',\'' + varName
				+ '\',this.value);" /></td>';
		html += '</tr>';
	}

	// UseRoomName
	varName = 'UseRoomName';
	varValue = get_device_state(graphiteDevId, GRAPHITE_SERVICE, varName);

	html += '<tr>';
	html += '<td width="100">UseRoomName</td>';
	html += '<td><input type="checkbox" id="graphite_state_' + graphiteDevId
			+ '_' + i + '" value="1" onChange="set_device_state('
			+ graphiteDevId + ',\'' + GRAPHITE_SERVICE + '\',\'' + varName
			+ '\',(this.checked?\'1\':\'0\'));"'
			+ (varValue == '1' ? ' checked' : '') + ' /><span></span></td>';
	html += '</tr>';

	html += '</table>';
	html += '';

	/*
	 * Metrics
	 */
	var metrics = get_metrics_settings(graphiteDevId);
	var device, metric;

	html += '<h3>Metrics</h3>';
	html += '<table width="100%" border="0" class="skinned-form-controls skinned-form-controls-mac" id="graphite_metrics">';
	html += '<tr>';
	html += '<th width="100">Device</th>';
	html += '<th>Data type</th>';
	html += '<th>Graphite path</th>';
	html += '<th>&nbsp;</th>';
	html += '</tr>';

	// Metrics rows
	for (device in metrics) {
		for (metric in metrics[device]) {
			html += build_metric_row(graphiteDevId, device, metric,
					metrics[device][metric]);
		}
	}

	// Blank row
	html += build_metric_row(graphiteDevId, '', '', '', 'add');
	html += '</table>';
	html += '';

	set_panel_html(html);
}
