# signalk-pisugar

A plugin for SignalK that gets information from an attached PiSugar battery module.

See https://www.pisugar.com/ for details on module itself.

# Features

1. Battery state of charge
1. TBD :)

## Tested:

* PiSugar2 Plus w/ Raspberry Pi 4

# Setup

## Required Software

This plugin requires the PiSugar server to be installed and running. Get it
from https://github.com/PiSugar/pisugar-power-manager-rs

## SignalK Configuration

1. Install the plugin via SignalK "Appstore"
1. Go to "Server > Plugin Config" and click "Configure" for "SignalK PiSugar Plugin"
1. Save the defaults (or change them) and there you go! Look at "Data Browser" and
   observe your chosen patch being updated.

# Troubleshooting

Check "Server > Server Log" for errors (red). Most common issue likely will be the
UNIX domain socket won't be readable. This may present itself as an EACCESS error.

Assuming /tmp/pisugar-server.sock is the path to the socket file, to change the
permissions at boot, add this to rc.local:

	chmod 666 /tmp/pisugar-server.sock

