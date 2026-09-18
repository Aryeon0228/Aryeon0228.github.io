/* STUDIO PENUMBRA · Qt edition / 3ds Max 2026 */
(
    local folder = getFilenamePath (getSourceFileName())
    local entry = pathConfig.appendPath folder "SnapUVQt.py"
    if (maxVersion())[1] < 28000 then
        messageBox "This Qt release targets 3ds Max 2026. For earlier versions, use the separate MAXScript download." title:"Penumbra / Max Tools"
    else if not (doesFileExist entry) then
        messageBox "Extract the complete ZIP and keep its folders together." title:"Penumbra / Max Tools"
    else
    (
        local result = python.ExecuteFile entry throwOnError:false clearUndoBuffer:false
        if result != #success do messageBox (python.GetLastError()) title:"Penumbra / Python Error"
    )
)
