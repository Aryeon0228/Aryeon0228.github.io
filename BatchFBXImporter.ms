/*
	Batch FBX Importer
	Import multiple FBX files at once into 3ds Max
*/

try(destroyDialog BatchFBXImporter) catch()

rollout BatchFBXImporter "Batch FBX Importer" width:400 height:320
(
	-- UI
	label lblInfo "Add FBX files to import." pos:[10,10]
	listbox lbxFiles "" pos:[10,30] width:380 height:10

	button btnAdd "Add Files" pos:[10,210] width:120 height:30
	button btnRemove "Remove Selected" pos:[140,210] width:120 height:30
	button btnClear "Clear All" pos:[270,210] width:120 height:30

	checkbox chkNewScene "Import each file into a new scene" pos:[10,250]
	checkbox chkMerge "Merge into current scene" pos:[10,270] checked:true

	button btnImport "Import" pos:[10,295] width:380 height:30

	-- File path storage
	local filePaths = #()

	-- Add files
	on btnAdd pressed do
	(
		local dlg = dotNetObject "System.Windows.Forms.OpenFileDialog"
		dlg.title = "Select FBX Files"
		dlg.filter = "FBX Files (*.fbx)|*.fbx|All Files (*.*)|*.*"
		dlg.multiSelect = true

		local result = dlg.showDialog()
		if result == (dotNetClass "System.Windows.Forms.DialogResult").OK do
		(
			local files = dlg.fileNames
			for i = 1 to files.count do
			(
				local f = files[i]
				append filePaths f
				local items = lbxFiles.items
				append items (getFilenameFile f + ".fbx")
				lbxFiles.items = items
			)
		)
	)

	-- Remove selected item
	on btnRemove pressed do
	(
		local sel = lbxFiles.selection
		if sel > 0 do
		(
			deleteItem filePaths sel
			local items = lbxFiles.items
			deleteItem items sel
			lbxFiles.items = items
		)
	)

	-- Clear all
	on btnClear pressed do
	(
		filePaths = #()
		lbxFiles.items = #()
	)

	-- Mutually exclusive checkboxes
	on chkNewScene changed state do
	(
		if state do chkMerge.checked = false
	)

	on chkMerge changed state do
	(
		if state do chkNewScene.checked = false
	)

	-- Run import
	on btnImport pressed do
	(
		if filePaths.count == 0 then
		(
			messageBox "No files to import." title:"Notice"
		)
		else
		(
			local successCount = 0
			local failCount = 0

			for i = 1 to filePaths.count do
			(
				local f = filePaths[i]

				if doesFileExist f then
				(
					try
					(
						if chkNewScene.checked do resetMaxFile #noPrompt

						importFile f #noPrompt using:FBXIMP
						successCount += 1
					)
					catch
					(
						format "*** Import failed: % - %\n" f (getCurrentException())
						failCount += 1
					)
				)
				else
				(
					format "*** File not found: %\n" f
					failCount += 1
				)
			)

			messageBox (successCount as string + " succeeded, " + failCount as string + " failed") title:"Import Complete"
		)
	)
)

createDialog BatchFBXImporter
