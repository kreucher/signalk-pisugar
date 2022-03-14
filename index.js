const net = require('net');
const fs = require('fs');

module.exports = function (app) {
  var plugin = {};
  var timer;

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

          // send to SignalK
          var batteryPct = Number(dataSz.match(/[\d\.]+/)[0]) / 100;
          if (batteryPct >= 0) {
            app.handleMessage(plugin.id, {
              updates: [{
                values: [{
                  path: options.battery_pct_path,
                  value: batteryPct
                }]
              }]
            });
          }

          client.destroy();
        })
        .on('error', function(data) {
          app.error('unable to connect to socket: ' + data.toString());
          client.destroy();
        });
    };

    timer = setInterval(pollUnixSocket, options.rate * 1000);
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

