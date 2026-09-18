/*
	Batch FBX Importer
	Add multiple FBX files to the current scene, or import them one at a time
	into new scenes with a save/cancel check before every scene reset.
*/

try(destroyDialog BatchFBXImporter) catch()

rollout BatchFBXImporter "Batch FBX Importer" width:400 height:516
(
	groupBox grpFiles "Files" pos:[16,16] width:368 height:280
	label lblInfo "Add FBX files to import." pos:[28,38] width:344 height:16
	-- Listbox height is in rows; leave room before the file actions.
	listbox lbxFiles "" pos:[28,62] width:344 height:10
	button btnAdd "Add Files" pos:[28,252] width:108 height:26
	button btnRemove "Remove Selected" pos:[146,252] width:108 height:26
	button btnClear "Clear All" pos:[264,252] width:108 height:26

	groupBox grpMode "Import mode" pos:[16,308] width:368 height:112
	checkbox chkMerge "Add files to current scene" pos:[28,330] width:344 height:20 checked:true
	checkbox chkNewScene "New scene for each file" pos:[28,354] width:344 height:20
	label lblSave "New scenes prompt to save; only the last stays open." pos:[28,382] width:344 height:16
	button btnImport "Import FBX Files" pos:[16,432] width:368 height:36
	label lblStudio "STUDIO PENUMBRA" pos:[238,484] width:146 height:16

	local filePaths = #()

	fn refreshFiles =
	(
		-- Show paths so files with the same name can be distinguished.
		lbxFiles.items = copy filePaths
	)

	fn setBusy busy =
	(
		btnAdd.enabled = not busy
		btnRemove.enabled = not busy
		btnClear.enabled = not busy
		btnImport.enabled = not busy
		chkNewScene.enabled = not busy
		chkMerge.enabled = not busy
	)

	on btnAdd pressed do
	(
		local dlg = dotNetObject "System.Windows.Forms.OpenFileDialog"
		try
		(
			dlg.title = "Select FBX Files"
			dlg.filter = "FBX Files (*.fbx)|*.fbx"
			dlg.multiSelect = true
			dlg.checkFileExists = true
			if dlg.showDialog() == (dotNetClass "System.Windows.Forms.DialogResult").OK do
			(
				local files = dlg.fileNames
				local knownPaths = for f in filePaths collect toLower f
				for i = 1 to files.count do
				(
					local f = files[i]
					if (toLower (getFilenameType f)) == ".fbx" and (findItem knownPaths (toLower f)) == 0 do
					(
						append filePaths f
						append knownPaths (toLower f)
					)
				)
				refreshFiles()
			)
		)
		catch (messageBox (getCurrentException() as string) title:"Cannot Add Files")
		dlg.dispose()
	)

	on btnRemove pressed do
	(
		local sel = lbxFiles.selection
		if sel > 0 and sel <= filePaths.count do
		(
			deleteItem filePaths sel
			refreshFiles()
		)
	)

	on btnClear pressed do
	(
		filePaths = #()
		refreshFiles()
	)

	-- Exactly one mode must remain selected.
	on chkNewScene changed state do chkMerge.checked = not state
	on chkMerge changed state do chkNewScene.checked = not state

	on btnImport pressed do
	(
		if filePaths.count == 0 then
		(
			messageBox "No files to import." title:"Notice"
			return undefined
		)

		local newSceneMode = chkNewScene.checked
		local oldSelection = selection as array
		local successCount = 0
		local failCount = 0
		local stopped = false
		local settingsSaved = false
		local progressStarted = false
		local errorText = undefined
		local files = copy filePaths
		setBusy true

		try
		(
			pluginManager.loadClass FBXIMP
			if (FBXImporterSetParam "PushSettings") != "OK" do throw "Could not preserve FBX import settings."
			settingsSaved = true
			-- FBX's #merge mode updates matching existing animation. This tool
			-- adds files, so use #create even when adding to a nonempty scene.
			if (FBXImporterSetParam "Mode" #create) != "OK" do throw "Could not set FBX Add mode."
			progressStart "Importing FBX files"
			progressStarted = true

			for i = 1 to files.count while not stopped do
			(
				local f = files[i]
				if not (progressUpdate (100.0 * (i - 1) / files.count)) then
					stopped = true
				else if not (doesFileExist f) then
				(
					format "*** File not found: %\n" f
					failCount += 1
				)
				else
				(
					-- Missing files are detected before resetting a scene.
					if newSceneMode do
					(
						-- In Quiet Mode checkForSave returns true without asking.
						if getQuietMode() do throw "New-scene import requires save prompts. Turn off Quiet Mode first."
						if checkForSave() then
							resetMaxFile #noPrompt
						else
							stopped = true
					)
					if not stopped do
					(
						try
						(
							-- Reapply after reset, which can affect plug-in state.
							if (FBXImporterSetParam "Mode" #create) != "OK" do throw "Could not set FBX Add mode."
							if (importFile f #noPrompt using:FBXIMP) != true do throw "FBX import failed or was cancelled."
							setSaveRequired true
							successCount += 1
							format "Imported: %\n" f
						)
						catch
						(
							failCount += 1
							stopped = true
							setSaveRequired true
							errorText = getCurrentException()
							format "*** Import stopped: % - %\n" f errorText
						)
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
				if (FBXImporterSetParam "PopSettings") != "OK" do throw "Could not restore FBX settings."
			)
			catch
			(
				errorText = "FBX settings could not be restored. Check the importer settings."
				format "*** %\n" (getCurrentException())
			)
		)
		if not newSceneMode do try (select (for obj in oldSelection where isValidNode obj collect obj)) catch()
		setBusy false
		local summary = successCount as string + " imported, " + failCount as string + " failed."
		if stopped do summary += "\nStopped; remaining files were not imported."
		if errorText != undefined do summary += "\n" + errorText as string
		if stopped and failCount > 0 do summary += "\nInspect the current scene for a partial import before continuing."
		messageBox summary title:"Import Result"
	)
)

createDialog BatchFBXImporter
