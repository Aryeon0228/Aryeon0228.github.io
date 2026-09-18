/*
	Quick Export FBX
	Apply export preparation to temporary copies, then export selected objects
	as Y-Up FBX. Original objects and the user's FBX settings are preserved.
*/

try(destroyDialog QuickExportFBX) catch()

rollout QuickExportFBX "Quick Export FBX" width:400 height:428
(
	groupBox grpDestination "Destination" pos:[16,16] width:368 height:90
	label lblFolder "Export folder" pos:[28,38] width:344 height:16
	edittext edtFolder "" pos:[28,64] width:252 height:17 readOnly:true
	button btnBrowse "Browse..." pos:[288,60] width:84 height:26

	groupBox grpPreparation "Preparation" pos:[16,118] width:368 height:124
	label lblPreparation "Applied to copies; original objects stay intact." pos:[28,140] width:344 height:16
	checkbox chkResetXForm "Reset XForm" pos:[28,164] width:344 height:20 checked:true
	checkbox chkCenterPivot "Center pivot to object" pos:[28,188] width:344 height:20 checked:true
	checkbox chkMoveOrigin "Move object to origin (0, 0, 0)" pos:[28,212] width:344 height:20 checked:true

	groupBox grpOutput "Output" pos:[16,254] width:368 height:80
	checkbox chkIndividual "Export each object as a separate file" pos:[28,276] width:344 height:20 checked:true
	label lblSafe "Existing files are kept; duplicates get a suffix." pos:[28,304] width:344 height:16
	button btnExport "Export FBX" pos:[16,346] width:368 height:36
	label lblStudio "STUDIO PENUMBRA" pos:[238,396] width:146 height:16

	local exportPath = ""

	fn setBusy busy =
	(
		btnExport.enabled = not busy
		btnBrowse.enabled = not busy
		chkResetXForm.enabled = not busy
		chkCenterPivot.enabled = not busy
		chkMoveOrigin.enabled = not busy
		chkIndividual.enabled = not busy
	)

	on btnBrowse pressed do
	(
		local dir = getSavePath caption:"Select Export Folder"
		if dir != undefined do
		(
			exportPath = pathConfig.appendPath dir ""
			edtFolder.text = exportPath
		)
	)

	fn safeFileName nodeName =
	(
		local clean = (dotNetClass "System.Text.RegularExpressions.Regex").Replace nodeName "[\\x00-\\x1F<>:\"/\\\\|?*]" "_"
		clean = trimRight clean " ."
		if clean == "" do clean = "object"
		local deviceName = toUpper ((filterString clean ".")[1])
		local reserved = #("CON", "PRN", "AUX", "NUL")
		for i = 1 to 9 do
		(
			append reserved ("COM" + (i as string))
			append reserved ("LPT" + (i as string))
		)
		if findItem reserved deviceName > 0 do clean = "_" + clean
		clean
	)

	fn unusedFilePath baseName =
	(
		local stem = safeFileName baseName
		local candidate = pathConfig.appendPath exportPath (stem + ".fbx")
		local suffix = 1
		while (doesFileExist candidate) or ((dotNetClass "System.IO.Directory").Exists candidate) do
		(
			candidate = pathConfig.appendPath exportPath (stem + "_" + (suffix as string) + ".fbx")
			suffix += 1
		)
		candidate
	)

	fn prepareCopy obj =
	(
		if chkResetXForm.checked do
		(
			resetXForm obj
			collapseStack obj
		)
		if chkCenterPivot.checked do obj.pivot = obj.center
	)

	fn setExportParam param value =
	(
		if (FBXExporterSetParam param value) != "OK" do
			throw ("FBX exporter does not support setting: " + param)
	)

	fn setupFBXExportSettings =
	(
		setExportParam "UpAxis" "Y"
		setExportParam "SmoothingGroups" true
		setExportParam "TangentSpaceExport" true
		setExportParam "Preserveinstances" false
		setExportParam "ASCII" false
		-- Keep the installed plug-in's selected FBX version; FBX202000 is not
		-- a documented FileVersion value and may silently be rejected.
	)

	fn exportCopies sourceNodes filePath =
	(
		local tempNodes = #()
		local actualSources = #()
		local errorText = undefined
		local exported = false

		-- Autodesk explicitly warns against cloneNodes inside undo off.
		undo "Quick Export FBX temporary copies" on
		(
			try
			(
				if not (maxOps.cloneNodes sourceNodes cloneType:#copy expandHierarchy:false actualNodeList:&actualSources newNodes:&tempNodes) do
					throw "Could not create temporary export copies."
				if tempNodes.count == 0 do throw "No temporary objects were created."

				with animate off
				(
					for i = 1 to tempNodes.count do
					(
						tempNodes[i].name = actualSources[i].name
						prepareCopy tempNodes[i]
					)
					if chkMoveOrigin.checked do
					(
						-- Move parents first so their movement cannot displace
						-- a child that has already been placed at the origin.
						local pending = copy tempNodes
						while pending.count > 0 do
						(
							for i = pending.count to 1 by -1 do
							(
								local obj = pending[i]
								if (findItem pending obj.parent) == 0 do
								(
									in coordsys world (obj.pos = [0,0,0])
									deleteItem pending i
								)
							)
						)
					)
				)
				select tempNodes
				exported = (exportFile filePath #noPrompt selectedOnly:true using:FBXEXP) == true
				if not exported do throw "FBX export failed or was cancelled."
				if not (doesFileExist filePath) do throw "The exporter did not create a file."
				if getFileSize filePath <= 0 do throw "The exported file is empty."
			)
			catch (errorText = getCurrentException())

			-- Cleanup is also reached after a failed/cancelled export.
			try
			(
				local remaining = for obj in tempNodes where isValidNode obj collect obj
				if remaining.count > 0 do delete remaining
			)
			catch
			(
				if errorText == undefined do errorText = "Temporary copies could not be removed."
				format "*** Temporary copy cleanup failed: %\n" (getCurrentException())
			)
		)
		if errorText != undefined do throw errorText
		exported
	)

	on btnExport pressed do
	(
		if exportPath == "" or not ((dotNetClass "System.IO.Directory").Exists exportPath) then
		(
			messageBox "Please select an existing export folder first." title:"Notice"
			return undefined
		)
		if selection.count == 0 then
		(
			messageBox "Please select objects to export." title:"Notice"
			return undefined
		)

		local objs = selection as array
		local successCount = 0
		local failCount = 0
		local stopped = false
		local settingsSaved = false
		local progressStarted = false
		local errorText = undefined
		local jobCount = if chkIndividual.checked then objs.count else 1
		setBusy true

		try
		(
			pluginManager.loadClass FBXEXP
			if (FBXExporterSetParam "PushSettings") != "OK" do throw "Could not preserve FBX export settings."
			settingsSaved = true
			setupFBXExportSettings()
			progressStart "Exporting FBX files"
			progressStarted = true

			for i = 1 to jobCount while not stopped do
			(
				if not (progressUpdate (100.0 * (i - 1) / jobCount)) then
					stopped = true
				else
				(
					local filePath = undefined
					try
					(
						local sourceNodes = if chkIndividual.checked then #(objs[i]) else objs
						filePath = unusedFilePath (if chkIndividual.checked then objs[i].name else "export")
						if exportCopies sourceNodes filePath do successCount += 1
						format "Exported: %\n" filePath
					)
					catch
					(
						failCount += 1
						stopped = true
						errorText = getCurrentException()
						format "*** Export stopped: % - %\n" filePath errorText
					)
				)
			)
		)
		catch (errorText = getCurrentException(); stopped = true)

		if progressStarted do try(progressEnd()) catch()
		if settingsSaved do
		(
			try
			(
				if (FBXExporterSetParam "PopSettings") != "OK" do throw "Could not restore FBX settings."
			)
			catch
			(
				errorText = "FBX settings could not be restored. Check the exporter settings."
				format "*** %\n" (getCurrentException())
			)
		)
		try (select (for obj in objs where isValidNode obj collect obj)) catch()
		setBusy false
		local summary = successCount as string + " file(s) exported, " + failCount as string + " failed."
		if stopped do summary += "\nStopped; remaining files were not exported."
		if errorText != undefined do summary += "\n" + errorText as string
		messageBox summary title:"Export Result"
	)
)

createDialog QuickExportFBX
