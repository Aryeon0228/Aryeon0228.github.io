try(destroyDialog rlt_uv_exporter)catch()

rollout rlt_uv_exporter "UV Exporter" width:160 height:120
(
    label lbl_res "Resolution"
    button btn_1k "1024 px" width:140 height:25
    button btn_2k "2048 px" width:140 height:25
    button btn_4k "4096 px" width:140 height:25

    fn close_render_map_window =
    (
        local allWindows = windows.getChildrenHWND (windows.getDesktopHWND())
        for win in allWindows do (
            if (matchPattern win[5] pattern:"Render Map*") do (
                windows.sendMessage win[1] 16 0 0
            )
        )
    )

    fn execute_uv_export res =
    (
        local rootDir = "C:\\UV_Temp"
        if not (doesFileExist rootDir) do (makeDir rootDir)

        local selObjects = selection as array
        if selObjects.count == 0 then (
            messageBox "No objects selected."
        ) else (
            pngio.setAlpha false
            pngio.setType #true24

            for targetObj in selObjects do (
                local uvMod = undefined
                for m in targetObj.modifiers do (
                    if classOf m == Unwrap_UVW do (uvMod = m; exit)
                )

                if uvMod == undefined do (
                    uvMod = Unwrap_UVW()
                    addModifier targetObj uvMod
                )

                select targetObj
                max modify mode
                modPanel.setCurrentObject uvMod

                uvMod.renderuv_width = res
                uvMod.renderuv_height = res

                local finalPath = pathConfig.appendPath rootDir (targetObj.name + ".png")
                if (doesFileExist finalPath) do (deleteFile finalPath)

                try (
                    uvMod.renderUV finalPath
                    close_render_map_window()
                    format "Exported [%px]: %\n" res finalPath
                ) catch (
                    format "Failed: %\n" targetObj.name
                )
            )

            shellLaunch "explorer.exe" rootDir
            destroyDialog rlt_uv_exporter
        )
    )

    on btn_1k pressed do execute_uv_export 1024
    on btn_2k pressed do execute_uv_export 2048
    on btn_4k pressed do execute_uv_export 4096
)

createDialog rlt_uv_exporter
