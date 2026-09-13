try(destroyDialog rlSmoothNormalBaker)catch()
callbacks.removeScripts id:#smoothNormalBakerCallback

rollout rlSmoothNormalBaker "Outline Normal Baker v1.5" width:320
(
    group "Info"
    (
        label lbl1 "MK Toon outline normals: UV7 / Max map 8" align:#left
        label lbl2 "Creates mesh copies at the current frame." align:#left
        label lbl3 "Original objects and modifier stacks are kept." align:#left
    )

    group "Bake"
    (
        label lblSelected "Selected: 0 objects" align:#left
        button btnBake "BAKE COPIES" width:280 height:40
        progressBar pbProgress value:0 width:280 height:10
    )

    group "Log"
    (
        editText etLog "" height:120 readOnly:true
    )

    button btnHelp "How to Use" width:140 align:#left across:2
    button btnClose "Close" width:140 align:#right

    fn isBakeCandidate obj =
    (
        if not isValidNode obj then return false
        if superClassOf obj != GeometryClass then return false
        try (canConvertTo obj Editable_Mesh) catch (false)
    )

    fn updateSelection =
    (
        local validCount = 0
        for obj in selection where isBakeCandidate obj do validCount += 1
        lblSelected.text = "Selected: " + (validCount as string) + " objects"
    )

    fn addLog msg =
    (
        if etLog.text == "" then
            etLog.text = msg
        else
            etLog.text = etLog.text + "\n" + msg
    )

    fn getVertAngle pivot p1 p2 =
    (
        local edge1 = p1 - pivot
        local edge2 = p2 - pivot
        local len1 = length edge1
        local len2 = length edge2
        if len1 == 0 or len2 == 0 then return 0.0
        local cosine = dot (edge1 / len1) (edge2 / len2)
        acos (amax (-1.0) (amin 1.0 cosine))
    )

    fn bakeSmoothedNormalToUV7 sourceObj =
    (
        local bakedObj = undefined
        -- Preserve the existing contract: Max map channel 8 and (normal + 1) / 2.
        -- Do not change channel numbering, axis conversion or packing without
        -- validating the receiving MK Toon shader and FBX import settings.
        local mapChannel = 8

        try
        (
            -- Snapshot evaluates the current frame into a new mesh node.
            -- Never collapse, convert or write map data on the source node.
            bakedObj = snapshot sourceObj name:(uniqueName (sourceObj.name + "_OutlineNormals"))
            if not isValidNode bakedObj then throw "Could not create a mesh copy."
            if classOf bakedObj.baseObject != Editable_Mesh then convertToMesh bakedObj
            if classOf bakedObj.baseObject != Editable_Mesh then throw "Copy is not an Editable Mesh."

            -- Passing the base object (without a node argument) reads local
            -- coordinates, independent of the active viewport coordinate system.
            local bakeMesh = bakedObj.baseObject
            local numVerts = meshop.getNumVerts bakeMesh
            local numFaces = meshop.getNumFaces bakeMesh
            if numVerts == 0 or numFaces == 0 then throw "Empty mesh."

            local normalSums = for v = 1 to numVerts collect [0,0,0]
            local validFaces = 0
            local skippedFaces = 0

            -- Keep the original area * corner-angle weighting. Accumulate each
            -- triangle once; topology and smoothing groups are not modified.
            -- Separate geometric vertices remain separate (no implicit weld).
            for f = 1 to numFaces do
            (
                local faceVerts = getFace bakeMesh f
                local i1 = faceVerts.x as integer
                local i2 = faceVerts.y as integer
                local i3 = faceVerts.z as integer
                local p1 = meshop.getVert bakeMesh i1
                local p2 = meshop.getVert bakeMesh i2
                local p3 = meshop.getVert bakeMesh i3
                local faceCross = cross (p2 - p1) (p3 - p1)
                local doubleArea = length faceCross

                if doubleArea > 0 then
                (
                    local faceNormal = faceCross / doubleArea
                    local area = doubleArea * 0.5
                    normalSums[i1] += faceNormal * (area * (getVertAngle p1 p2 p3))
                    normalSums[i2] += faceNormal * (area * (getVertAngle p2 p1 p3))
                    normalSums[i3] += faceNormal * (area * (getVertAngle p3 p1 p2))
                    validFaces += 1
                )
                else skippedFaces += 1
            )

            if validFaces == 0 then throw "Mesh has no non-degenerate triangles."

            -- setNumMaps defaults to keep:false, which discards existing UVs.
            if meshop.getNumMaps bakeMesh <= mapChannel do
                meshop.setNumMaps bakeMesh (mapChannel + 1) keep:true
            meshop.setMapSupport bakeMesh mapChannel true
            meshop.setNumMapVerts bakeMesh mapChannel numVerts
            meshop.setNumMapFaces bakeMesh mapChannel numFaces

            local fallbackVerts = 0
            for v = 1 to numVerts do
            (
                local smoothNormal = normalSums[v]
                if length smoothNormal > 0 then
                    smoothNormal = normalize smoothNormal
                else
                (
                    -- Preserve the original fallback for isolated/cancelling vertices.
                    smoothNormal = [0,0,1]
                    fallbackVerts += 1
                )
                meshop.setMapVert bakeMesh mapChannel v ((smoothNormal + [1,1,1]) / 2.0)
            )

            for f = 1 to numFaces do
                meshop.setMapFace bakeMesh mapChannel f (getFace bakeMesh f)

            update bakedObj
            -- Keep the triangulated output, avoiding another destructive conversion.
            #(bakedObj, skippedFaces, fallbackVerts)
        )
        catch
        (
            local errMsg = getCurrentException()
            if isValidNode bakedObj do delete bakedObj
            throw errMsg
        )
    )

    on btnBake pressed do
    (
        -- Capture selection before creating any nodes. Work at object level only.
        local validObjs = for obj in (selection as array) where isBakeCandidate obj collect obj
        if validObjs.count == 0 then
        (
            messageBox "Please select geometry that can be converted to a mesh." title:"Notice"
            return()
        )

        etLog.text = ""
        pbProgress.value = 0
        btnBake.enabled = false
        local bakedObjs = #()
        local totalCount = validObjs.count

        try
        (
            undo "Bake Outline Normal Copies" on
            (
                for i = 1 to totalCount do
                (
                    local obj = validObjs[i]
                    local sourceName = if isValidNode obj then obj.name else "<deleted object>"
                    try
                    (
                        if not isBakeCandidate obj then throw "Object is no longer available for baking."
                        local result = bakeSmoothedNormalToUV7 obj
                        append bakedObjs result[1]
                        addLog ("Done: " + result[1].name)
                        if result[2] > 0 do addLog ("  Degenerate faces skipped: " + (result[2] as string))
                        if result[3] > 0 do addLog ("  Fallback normals: " + (result[3] as string))
                    )
                    catch
                    (
                        addLog ("Fail: " + sourceName)
                        addLog ("  > " + (getCurrentException() as string))
                    )
                    pbProgress.value = ((i as float / totalCount * 100) as integer)
                )
                -- Export Selected can now use the finished copies only.
                if bakedObjs.count > 0 do select bakedObjs
            )
        )
        catch
        (
            addLog ("Stopped: " + (getCurrentException() as string))
        )

        btnBake.enabled = true
        updateSelection()
        addLog ("Complete: " + (bakedObjs.count as string) + "/" + (totalCount as string))
        addLog "Originals kept. Baked copies use the _OutlineNormals suffix."
        messageBox ((bakedObjs.count as string) + " mesh copies baked.\nOriginal objects were kept.") title:"Complete"
    )

    on btnHelp pressed do
    (
        messageBox "1. Select source objects and set the desired frame.\n2. Click [BAKE COPIES].\n3. Export Selected to FBX, preserving UV channels.\n4. Use your existing MK Toon UV7 / Outline Data setup.\n\nThe output is a static Editable Mesh copy.\nSource modifiers and animation are kept on the original only.\n\nExisting encoding: Max map channel 8, (normal + 1) / 2.\nMap 8 is replaced on the copy; other map channels are retained.\nVerify the UV channel and normal axes after FBX import.\n\nThe whole batch can be undone once." title:"How to Use"
    )

    on btnClose pressed do destroyDialog rlSmoothNormalBaker

    on rlSmoothNormalBaker open do
    (
        updateSelection()
        callbacks.addScript #selectionSetChanged "try(rlSmoothNormalBaker.updateSelection())catch()" id:#smoothNormalBakerCallback
    )

    on rlSmoothNormalBaker close do callbacks.removeScripts id:#smoothNormalBakerCallback
)

createDialog rlSmoothNormalBaker
