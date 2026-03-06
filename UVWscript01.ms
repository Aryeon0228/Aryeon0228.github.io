global g_uv_export_folder_opened
global rlt_uv_exporter

try(destroyDialog rlt_uv_exporter)catch()

rollout rlt_uv_exporter "UV Exporter" width:160 height:120
(
    label lbl_res "??? ??"
    button btn_1k "1024 px" width:140 height:25
    button btn_2k "2048 px" width:140 height:25
    button btn_4k "4096 px" width:140 height:25

    fn execute_uv_export res =
    (
        local rootDir = "C:\\UV_Temp"
        if not (doesFileExist rootDir) do (makeDir rootDir)
        if g_uv_export_folder_opened == undefined do g_uv_export_folder_opened = false

        local selObjects = selection as array
        if selObjects.count > 0 then (
            local nameList = for o in selObjects collect o.name
            sort nameList
            local chosenName = nameList[1]
            local targetObj = getNodeByName chosenName
            
            select targetObj
            local uvMod = undefined
            for m in targetObj.modifiers do (
                if classOf m == Unwrap_UVW do (uvMod = m; exit)
            )
            
            if uvMod == undefined do (
                uvMod = Unwrap_UVW()
                addModifier targetObj uvMod
            )
            
            max modify mode
            modPanel.setCurrentObject uvMod

            local finalPath = pathConfig.appendPath rootDir (chosenName + ".png")
            pngio.setAlpha false
            pngio.setType #true24
            
            uvMod.renderuv_width = res
            uvMod.renderuv_height = res
            
            if (doesFileExist finalPath) do (deleteFile finalPath)
            
            try (
                uvMod.renderUV finalPath
                if not g_uv_export_folder_opened do (
                    shellLaunch "explorer.exe" rootDir
                    g_uv_export_folder_opened = true
                )
                
                local allWindows = windows.getChildrenHWND (windows.getDesktopHWND())
                for win in allWindows do (
                    if (matchPattern win[5] pattern:"Render Map*") do (
                        windows.sendMessage win[1] 16 0 0
                    )
                )
                format "?? ?? (%px): %\n" res finalPath
            ) catch (
                format "??: ??? ??\n"
            )
        ) else (
            messageBox "??? ??????."
        )
    )

    on btn_1k pressed do (execute_uv_export 1024; destroyDialog rlt_uv_exporter)
    on btn_2k pressed do (execute_uv_export 2048; destroyDialog rlt_uv_exporter)
    on btn_4k pressed do (execute_uv_export 4096; destroyDialog rlt_uv_exporter)
)

createDialog rlt_uv_exporter