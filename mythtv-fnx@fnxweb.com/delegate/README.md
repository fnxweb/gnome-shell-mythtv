This directory must contain the scripts that will fetch the data for the extension.

**get-status-myth**  [supplied]  _{called every 5 minutes}_
>This script connects to the MythTV backend and pulls out the XML status
 report and prints it out.  It presumes that mythfrontend has been properly
 run and configured on the current machine in order to find the backend.

**get-status-free**  [optional]  _{called every 45 seconds}_
>The extension can display free disc space.  If this delegate is supplied,
 it is expected to print two lines, each being a floating point value.  On
 the first line should be the number of GB free on the MythTV recording
 system.  The second should be the rough number of hours free.

**get-status**  _[optional]_
>This script, if found, is used in preference to the above two scripts.  It
 will be called with either 'free' or 'myth' as the first argument, in which
 case it is expected to display the equivalent output of each of the above
 scripts.


If only the supplied get-status-myth script is found, the free space reported
will be that reported by MythTV in its XML, and will only be updated every 5
minutes (along with the main data).  Free space in hours will not be shown.
