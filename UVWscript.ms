/*
    UV Exporter
    Export UV templates from temporary copies; keep the original modifier stack.
*/
try(destroyDialog rlt_uv_exporter)catch()

rollout rlt_uv_exporter "UV Exporter" width:400 height:280
(
    groupBox grpSource "Source" pos:[16,16] width:368 height:88
    label lblSource "Export UV templates from selected geometry." pos:[28,40] width:344 height:18
    label lblOriginal "Original objects and modifier stacks are kept." pos:[28,64] width:344 height:18

    groupBox grpExport "Export" pos:[16,116] width:368 height:116
    label lbl_res "PNG resolution" pos:[28,140] width:344 height:18
    button btn_1k "1024 px" pos:[28,164] width:108 height:36
    button btn_2k "2048 px" pos:[146,164] width:108 height:36
    button btn_4k "4096 px" pos:[264,164] width:108 height:36
    label lbl_folder "Choose a folder after clicking a resolution." pos:[28,208] width:344 height:16

    label lblStudio "STUDIO PENUMBRA" pos:[238,248] width:146 height:16

    fn uniqueOutputPath folder objectName res =
    (
        local safeName = (dotNetClass "System.Text.RegularExpressions.Regex").Replace objectName "[<>:\"/\\\\|?*\\x00-\\x1F]" "_"
        safeName = trimRight (trimLeft safeName) " ."
        if safeName == "" do safeName = "Object"
        if safeName.count > 100 do safeName = substring safeName 1 100
        -- Prefix also avoids Windows device names such as CON and NUL.
        local stem = "UV_" + safeName + "_" + (res as string)
        local result = pathConfig.appendPath folder (stem + ".png")
        local suffix = 2
        while doesFileExist result do
        (
            result = pathConfig.appendPath folder (stem + "_" + (suffix as string) + ".png")
            suffix += 1
        )
        result
    )

    fn execute_uv_export res =
    (
        local originalSelection = selection as array
        local targets = for obj in originalSelection where isValidNode obj and superClassOf obj == GeometryClass collect obj
        if targets.count == 0 then
        (
            messageBox "Select at least one geometry object." title:"UV Exporter"
            return false
        )
        local folder = getSavePath caption:"Choose UV template folder"
        if folder == undefined do return false
        if not doesDirectoryExist folder then
        (
            messageBox "The output folder does not exist." title:"UV Exporter"
            return false
        )

        local oldPanel = getCommandPanelTaskMode()
        local oldCurrent = modPanel.getCurrentObject()
        local oldLevel = subObjectLevel
        local oldAlpha = pngio.getAlpha()
        local oldType = pngio.getType()
        local successes = 0
        local failures = 0
        local fatalError = undefined
        local tempObj = undefined

        btn_1k.enabled = false
        btn_2k.enabled = false
        btn_4k.enabled = false
        undo "Export UV Templates" on
        (
            try
            (
                pngio.setAlpha false
                pngio.setType #true24
                for targetObj in targets do
                (
                    local outputPath = undefined
                    try
                    (
                        if not isValidNode targetObj do throw "The source object is no longer available."
                        outputPath = uniqueOutputPath folder targetObj.name res
                        tempObj = copy targetObj
                        if not isValidNode tempObj do throw "Could not create a temporary copy."
                        tempObj.name = uniqueName "__UV_EXPORT_TEMP_"
                        select tempObj
                        max modify mode
                        subObjectLevel = 0
                        local uvMod = undefined
                        for modifier in tempObj.modifiers where classOf modifier == Unwrap_UVW do
                        (
                            uvMod = modifier
                            exit
                        )
                        if uvMod == undefined do
                        (
                            uvMod = Unwrap_UVW()
                            addModifier tempObj uvMod
                        )
                        modPanel.setCurrentObject uvMod
                        uvMod.renderuv_width = res
                        uvMod.renderuv_height = res
                        -- Use the actual option instead of closing other Render Map windows.
                        uvMod.renderuv_showframebuffer = false
                        uvMod.renderUV outputPath
                        if not (doesFileExist outputPath) do throw "No PNG file was written."
                        if (getFileSize outputPath) <= 0 do throw "The PNG file is empty."
                        successes += 1
                        format "Exported [%px]: %\n" res outputPath
                    )
                    catch
                    (
                        failures += 1
                        format "*** UV export failed: % - %\n" targetObj (getCurrentException())
                    )
                    -- Clean up even if rendering failed; never delete a user's previous PNG.
                    if isValidNode tempObj do delete tempObj
                    tempObj = undefined
                )
            )
            catch (fatalError = getCurrentException())
            if isValidNode tempObj do
            (
                try(delete tempObj)catch(format "*** Temporary copy could not be removed: %\n" tempObj)
            )
        )
        -- Restore UI and global PNG preferences even after a failure.
        try(pngio.setAlpha oldAlpha)catch()
        try(pngio.setType oldType)catch()
        try
        (
            local remaining = for obj in originalSelection where isValidNode obj collect obj
            if remaining.count > 0 then select remaining else clearSelection()
            setCommandPanelTaskMode oldPanel
            if oldPanel == #modify and oldCurrent != undefined do modPanel.setCurrentObject oldCurrent
            if oldLevel != undefined do subObjectLevel = oldLevel
        )
        catch(format "*** Could not fully restore the command panel: %\n" (getCurrentException()))
        btn_1k.enabled = true
        btn_2k.enabled = true
        btn_4k.enabled = true
        if fatalError != undefined do format "*** UV export stopped: %\n" fatalError
        if successes > 0 do
            try(shellLaunch "explorer.exe" ("\"" + folder + "\""))catch()
        local summary = (successes as string) + " exported, " + (failures as string) + " failed."
        local skipped = originalSelection.count - targets.count
        if skipped > 0 do summary += "\n" + (skipped as string) + " non-geometry object(s) skipped."
        if fatalError != undefined do summary += "\nExport stopped. See the MAXScript Listener."
        messageBox summary title:"UV Exporter"
        successes > 0
    )

    on btn_1k pressed do execute_uv_export 1024
    on btn_2k pressed do execute_uv_export 2048
    on btn_4k pressed do execute_uv_export 4096
)

createDialog rlt_uv_exporter
