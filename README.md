GNOME Shell MythTV
==================

GNOME Shell extension to report MythTV status.  Licensed under the GPL V3.


### Installation

#### The easy way

Install it from the [GNOME Extensions website](https://extensions.gnome.org/).

#### The difficult way

Download the ZIP file (from the link above), and then install it from the GNOME
*Advanced Settings* application's “Shell Extensions/Install Shell Extension”
function.

Alternatively, unpack **mythtv-fnx<span>@</span>fnxweb.com** as the directory
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
the extension allows you to specify an alternate location from which to get its
information.  Copy the existing file **config.eg** to **config** and edit it to
point to a local HTTP server that can provide the required information.  Each
config. line takes a name (“free” or “myth”), an update period in seconds and a
URL.

You will **have** to do this now if you have a MythTV version less than 0.26
due to it now using the new MythTV services API.

The “myth” data should be the standard Myth XML output.  The optional “free”
data should be two to three lines, each with a numerical value.  The first line
must be the free space in GB, the second the number of hours of recording this
represents.  If present, the third line must be a percentage-used value, which
is used if the free space is particularly large (about 150 hours).

![Screenshot](https://github.com/fnxweb/gnome-shell-mythtv/raw/master/images/screenshot-2.png)

See the **config.eg** file for details.


### Customisation

There's nothing in the way of customisation as yet;  if you want to change any
settings (such as enabling debug or changing the timer values) you'll have to
edit the code & restart GNOME Shell.  All the relevant settings are near the
top of **extensions.js**.


### ESLint

I'm trying to use ESLint to sanity check the code so will check in some of what I think I need.

To install:
```
npm init @eslint/config
```
To run:
```
npx eslint pi-hole@fnxweb.com
```


© Neil Bird  git@fnxweb.com
