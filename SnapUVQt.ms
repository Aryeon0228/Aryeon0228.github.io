/* STUDIO PENUMBRA — Snap UV Vertices, Qt edition launcher.
   Keep SnapUVQt.py beside this file. Target: 3ds Max 2026.
*/
(
    local scriptFolder = getFilenamePath (getSourceFileName())
    local pythonFile = pathConfig.appendPath scriptFolder "SnapUVQt.py"
    if (maxVersion())[1] < 28000 then
        messageBox "This Qt edition is prepared for 3ds Max 2026 or newer." title:"Penumbra / Snap UV"
    else if not doesFileExist pythonFile then
        messageBox "Extract the complete ZIP first. Keep SnapUVQt.py in the same folder as SnapUVQt.ms." title:"Penumbra / Snap UV"
    else
    (
        -- Opening the UI must not clear the user's existing Undo history.
        local result = python.ExecuteFile pythonFile throwOnError:false clearUndoBuffer:false
        if result != #success do
            messageBox (python.GetLastError()) title:"Penumbra / Python Error"
    )
)
