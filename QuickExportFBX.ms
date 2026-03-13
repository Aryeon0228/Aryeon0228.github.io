/*
	Quick Export FBX
	One-click script that applies Reset XForm, centers pivot, moves to origin,
	and exports selected objects as Y-Up FBX
*/

try(destroyDialog QuickExportFBX) catch()

rollout QuickExportFBX "Quick Export FBX" width:400 height:195
(
	-- UI
	label lblFolder "Export Folder:" pos:[10,10]
	edittext edtFolder "" pos:[10,28] width:310 readOnly:true
	button btnBrowse "..." pos:[325,28] width:65 height:20

	checkbox chkResetXForm "Reset XForm" pos:[10,60] checked:true
	checkbox chkCenterPivot "Center pivot to object" pos:[10,80] checked:true
	checkbox chkMoveOrigin "Move object to origin (0,0,0)" pos:[10,100] checked:true
	checkbox chkIndividual "Export each object as separate file" pos:[10,120] checked:true

	button btnExport "Export" pos:[10,150] width:380 height:35

	-- Export path
	local exportPath = ""

	-- Browse folder
	on btnBrowse pressed do
	(
		local dir = getSavePath caption:"Select Export Folder"
		if dir != undefined do
		(
			exportPath = dir + "\\"
			edtFolder.text = exportPath
		)
	)

	-- Process object before export
	fn processAndExport obj =
	(
		if chkResetXForm.checked do
		(
			resetXForm obj
			collapseStack obj
		)

		if chkCenterPivot.checked do
		(
			obj.pivot = obj.center
		)

		if chkMoveOrigin.checked do
		(
			obj.pos = [0, 0, 0]
		)
	)

	fn setupFBXExportSettings =
	(
		-- Y-Up (3ds Max is Z-Up, so convert)
		FBXExporterSetParam "UpAxis" "Y"
		FBXExporterSetParam "SmoothingGroups" true
		FBXExporterSetParam "TangentSpaceExport" true
		FBXExporterSetParam "Preserveinstances" false
		FBXExporterSetParam "ASCII" false
		FBXExporterSetParam "FileVersion" "FBX202000"
	)

	-- Run export
	on btnExport pressed do
	(
		if exportPath == "" then
		(
			messageBox "Please select an export folder first." title:"Notice"
			return undefined
		)

		if selection.count == 0 then
		(
			messageBox "Please select objects to export." title:"Notice"
			return undefined
		)

		local objs = selection as array
		local successCount = 0

		setupFBXExportSettings()

		if chkIndividual.checked then
		(
			-- Export as individual files
			for obj in objs do
			(
				try
				(
					processAndExport obj

					select obj
					local filePath = exportPath + obj.name + ".fbx"
					exportFile filePath #noPrompt selectedOnly:true using:FBXEXP

					successCount += 1
				)
				catch
				(
					format "*** Export failed: % - %\n" obj.name (getCurrentException())
				)
			)
		)
		else
		(
			-- Export all as single file
			try
			(
				for obj in objs do processAndExport obj

				select objs
				local filePath = exportPath + "export.fbx"
				exportFile filePath #noPrompt selectedOnly:true using:FBXEXP

				successCount = objs.count
			)
			catch
			(
				format "*** Export failed: %\n" (getCurrentException())
			)
		)

		select objs
		messageBox (successCount as string + " object(s) exported successfully") title:"Done"
	)
)

createDialog QuickExportFBX
