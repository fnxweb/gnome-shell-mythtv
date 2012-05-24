GNOME Shell MythTV
==================

GNOME Shell extension to report MythTV status.  Licensed under the GPL V3.

**Currently for GNOME 3.2.**


### Installation

Until such a time as I can persuade the extensions guys to allow an extension
that contains a few lines of bash script, I'm afraid you will have to install
manually from this site.

Download the ZIP file (from the link above), and then install it from the GNOME
*Advanced Settings* application's “Shell Extensions/Install Shell Extension”
function.

Alternatively, unpack **mythtv-fnx@fnxweb.com** as the directory
***~/.local/share/gnome-shell/extensions/mythtv-fnx@fnxweb.com***
alongside any other extensions you have.

Then simply restart gnome-shell with ***<Alt-F2>r***.  You may have to manually
enable the extension via the **advanced-settings** GUI.


### Main functionality

This extension polls your MythTV backend periodically (every 5 minutes by
default).  Clicking on the Myth button that it adds to the panel pops up a
status report showing basic status and upcoming recordings.

![Screenshot](https://github.com/fnxweb/gnome-shell-mythtv/raw/master/images/screenshot-1.png)

This should Just Work™ if you have configured **mythfrontend** to run on your machine.

If you have problems, edit **extension.js** and set **Debug** to *true*, then
see what gets reported to the *Errors* tab of the GNOME Shell Looking-Glass, or
to **~/.xsession-errors**.  Don't forget to turn the debug back off later.


### Optional functionality

On my personal setup, I already fetch the MythTV XML report and squirrel it
away in MySQL for other utilities to get at it (to reduce load on my backend).
I also know roughly how much space each recording takes up, and so can
calculate, given (a) how much disc space is actually free and (b) how much
space is currently taken up by “LiveTV” and “Deleted” recordings, as I take
their anticipated deletion into account.

Mostly to support this, but also to allow for others doing something similar,
the extension uses delegate scripts to fetch the data it wants in the
background.  The default supplied one fetches data straight from the backend,
but you may optionally supply another to fetch free-space information as well
(or one that does both).

![Screenshot](https://github.com/fnxweb/gnome-shell-mythtv/raw/master/images/screenshot-2.png)

See the README in the delegate subdirectory within the extension for more details.


### Customisation

There's nothing in the way of customisation as yet;  if you want to change any
settings (such as enabling debug or changing the timer values) you'll have to
edit the code & restart GNOME Shell.  All the relevant settings are near the
top of **extensions.js**.


© Neil Bird  git@fnxweb.com
