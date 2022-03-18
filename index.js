const net = require('net');
const fs = require('fs');

module.exports = function (app) {
  var plugin = {};
  var timer;
  var rate;
  var connected = false;

  plugin.id = 'signalk-pisugar';
  plugin.name = 'SignalK PiSugar Plugin';
  plugin.description = 'SignalK plugin for the PiSugar Raspberry Pi battery module';

  plugin.start = function (options, restartPlugin) {
    // Here we put our plugin logic
    app.debug('Plugin started');

    // send our metadata
    app.handleMessage(plugin.id, {
      updates: [{
        meta: [{
          path: options.battery_pct_path,
          value: {
            units: "ratio"
          }
        }]
      }]
    });

    // loop called via setInterval below
    function pollUnixSocket() {
      app.debug('pollUnixSocket ' + options.unix_socket);

      client = net.createConnection(options.unix_socket)
        .on('connect', ()=> {
          client.write('get battery');
        })
        .on('data', function(data) {
          var dataSz = data.toString();
          app.debug('got data => ' + dataSz);

          // parse response
          var battPct = Number(dataSz.match(/[\d\.]+/)[0]);
          if (!battPct || battPct <= 0) {
            app.setPluginError('Bad response from pisugar-server: ' + dataSz);
            app.error('Could not parse pisugar-server response, expected a float, got: ' + dataSz);
            backoffPolling();
          } else {
            // ok we got valid data, indicate we are good
            if (!connected) {
              connected = true;
              app.setPluginStatus("Connected to pisugar-server.");
              setupPolling();
            }

            // send to SignalK
            app.handleMessage(plugin.id, {
              updates: [{
                values: [{
                  path: options.battery_pct_path,
                  value: (battPct / 100.0)
                }]
              }]
            });
          }

          client.destroy();
        })
        .on('error', function(err) {
          connected = false;
          app.error('unable to connect to socket: ' + err.toString());
          switch(client._readableState.errored.code) {
            case 'ENOENT':
              app.setPluginError('Can not connect to pisugar-server, is it running?');
              break;

            case 'EACCES':
              app.setPluginError('Permission denied: ' + options.unix_socket + '. Read/Write access required.');
              break;

            default:
              app.setPluginError('Error connecting to socket:' + err.toString());
          }
          backoffPolling();
          client.destroy();
        });
    };

    function setupPolling(backoff=false) {
      if (!backoff && timer && (rate == options.rate * 1000)) {
        // setup correcty already
        return;
      }

      if (timer) {
        clearInterval(timer);
      }

      if (!rate || rate == 0) {
        rate = options.rate * 1000;
      }

      if (backoff) {
        // max backoff at ~10x normal rate
        if (rate < (options.rate * 1000 * 10)) {
          rate = rate * 2;
          app.debug('reducing rate by 2x to ' + rate + 'ms due to error');
        }
      } else if (rate != (options.rate * 1000)) {
        app.debug('resetting rate due to sucessful connection');
        connected = true;
        app.setPluginStatus("Re-connected to pisugar-server.");
        rate = options.rate * 1000;
      }

      timer = setInterval(pollUnixSocket, rate);
    };

    function backoffPolling() {
      setupPolling(true);
    };

    setupPolling();
  };

  plugin.stop = function () {
    // Here we put logic we need when the plugin stops
    app.debug('Plugin stopped');

    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  plugin.schema = {
    type: 'object',
    properties: {
      unix_socket: {
        type: 'string',
        title: 'Path to UNIX domain socket',
        default: '/tmp/pisugar-server.sock'
      },
      battery_pct_path: {
        type: 'string',
        title: 'SignalK path to publish PiSugar battery % to',
        default: 'environment.rpi.battery.stateOfCharge'
      },
      rate: {
        type: 'number',
        title: 'Poll rate, aka how often to read PiSugar state (in seconds)',
        default: 5
      }
    }
  };

  return plugin;
};

