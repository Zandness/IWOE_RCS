import {
  useEffect,
  useRef,
  useState,
} from "react";


const SCALE = 30;

const AUTO_PAN_EDGE = 60;
const AUTO_PAN_SPEED = 12;

const DRAG_THRESHOLD = 6;

const FIT_PADDING = 70;

const MIN_BOUNDARY_SIZE = 1;

const MINI_WIDTH = 190;
const MINI_HEIGHT = 130;
const MINI_PADDING = 12;


export default function MapCanvas({
  mapData,

  mode,
  tool,

  selectedNodeId,
  selectedEdgeId,

  boundarySelected,

  connectionStart,

  robots = [],

  selectedRobotId,
  onRobotClick,

  zoom,
  onZoomChange,

  fitRequest,

  onCanvasClick,

  onNodeClick,
  onNodeMove,

  onNodeDragStart,
  onNodeDragEnd,

  onEdgeClick,

  onBoundaryClick,
  onBoundaryDragStart,
  onBoundaryChange,
  onBoundaryDragEnd,
}) {
  const viewportRef =
    useRef(null);


  const panRef =
    useRef({
      x: 220,
      y: 150,
    });


  const panDragRef =
    useRef(null);


  const nodeDragRef =
    useRef(null);


  const boundaryDragRef =
    useRef(null);


  const autoPanFrameRef =
    useRef(null);


  const dragPointerRef =
    useRef(null);


  const [
    pan,
    setPan,
  ] = useState({
    x: 220,
    y: 150,
  });


  /*
   * =====================================================
   * PAN
   * =====================================================
   */

  function updatePan(
    nextPan
  ) {
    panRef.current =
      nextPan;

    setPan(
      nextPan
    );
  }


  /*
   * =====================================================
   * FIT
   * =====================================================
   */

  useEffect(() => {
    if (
      !fitRequest
    ) {
      return;
    }

    fitMapToViewport();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);


  function fitMapToViewport() {
    const viewport =
      viewportRef.current;

    if (
      !viewport
    ) {
      return;
    }

    const rect =
      viewport.getBoundingClientRect();

    const bounds =
      calculateMapBounds(
        mapData
      );

    const worldWidth =
      Math.max(
        (
          bounds.maxX -
          bounds.minX
        ) *
          SCALE,
        SCALE
      );

    const worldHeight =
      Math.max(
        (
          bounds.maxY -
          bounds.minY
        ) *
          SCALE,
        SCALE
      );

    const availableWidth =
      Math.max(
        rect.width -
          FIT_PADDING * 2,
        100
      );

    const availableHeight =
      Math.max(
        rect.height -
          FIT_PADDING * 2,
        100
      );

    const nextZoom =
      clamp(
        Math.min(
          availableWidth /
            worldWidth,

          availableHeight /
            worldHeight
        ),
        0.25,
        4
      );

    const centerWorldX =
      (
        bounds.minX +
        bounds.maxX
      ) /
      2 *
      SCALE;

    const centerWorldY =
      (
        bounds.minY +
        bounds.maxY
      ) /
      2 *
      SCALE;

    const nextPan = {
      x:
        rect.width /
          2 -
        centerWorldX *
          nextZoom,

      y:
        rect.height /
          2 -
        centerWorldY *
          nextZoom,
    };

    updatePan(
      nextPan
    );

    onZoomChange(
      Number(
        nextZoom.toFixed(
          3
        )
      )
    );
  }


  /*
   * =====================================================
   * COORDINATES
   * =====================================================
   */

  function screenToWorld(
    clientX,
    clientY
  ) {
    const viewport =
      viewportRef.current;

    if (
      !viewport
    ) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      viewport.getBoundingClientRect();

    return {
      x:
        (
          clientX -
          rect.left -
          panRef.current.x
        ) /
        zoom /
        SCALE,

      y:
        (
          clientY -
          rect.top -
          panRef.current.y
        ) /
        zoom /
        SCALE,
    };
  }


  /*
   * =====================================================
   * BACKGROUND PAN
   * =====================================================
   */

  function handleBackgroundPointerDown(
    event
  ) {
    const middle =
      event.button === 1;

    const left =
      event.button === 0 &&
      (
        tool === "select" ||
        mode === "monitor"
      );

    if (
      !middle &&
      !left
    ) {
      return;
    }

    event.preventDefault();

    panDragRef.current = {
      pointerId:
        event.pointerId,

      startX:
        event.clientX,

      startY:
        event.clientY,

      panX:
        panRef.current.x,

      panY:
        panRef.current.y,

      moved:
        false,
    };

    try {
      event.currentTarget
        .setPointerCapture(
          event.pointerId
        );
    } catch {
      //
    }
  }


  function handleBackgroundPointerMove(
    event
  ) {
    const drag =
      panDragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const dx =
      event.clientX -
      drag.startX;

    const dy =
      event.clientY -
      drag.startY;

    if (
      Math.abs(dx) > 3 ||
      Math.abs(dy) > 3
    ) {
      drag.moved =
        true;
    }

    updatePan({
      x:
        drag.panX +
        dx,

      y:
        drag.panY +
        dy,
    });
  }


  function handleBackgroundPointerUp(
    event
  ) {
    const drag =
      panDragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    panDragRef.current =
      null;

    if (
      drag.moved
    ) {
      return;
    }

    if (
      event.button !== 0
    ) {
      return;
    }

    onCanvasClick(
      screenToWorld(
        event.clientX,
        event.clientY
      )
    );
  }


  /*
   * =====================================================
   * ZOOM
   * =====================================================
   */

  function handleWheel(
    event
  ) {
    event.preventDefault();

    const viewport =
      viewportRef.current;

    if (
      !viewport
    ) {
      return;
    }

    const rect =
      viewport.getBoundingClientRect();

    const mouseX =
      event.clientX -
      rect.left;

    const mouseY =
      event.clientY -
      rect.top;

    const oldZoom =
      zoom;

    const nextZoom =
      clamp(
        oldZoom *
          (
            event.deltaY < 0
              ? 1.1
              : 0.9
          ),
        0.25,
        4
      );

    const worldX =
      (
        mouseX -
        panRef.current.x
      ) /
      oldZoom;

    const worldY =
      (
        mouseY -
        panRef.current.y
      ) /
      oldZoom;

    updatePan({
      x:
        mouseX -
        worldX *
          nextZoom,

      y:
        mouseY -
        worldY *
          nextZoom,
    });

    onZoomChange(
      Number(
        nextZoom.toFixed(
          3
        )
      )
    );
  }


  /*
   * =====================================================
   * NODE DRAG
   * =====================================================
   */

  function handleNodePointerDown(
    event,
    node
  ) {
    event.stopPropagation();

    if (
      mode !== "edit"
    ) {
      return;
    }

    if (
      tool === "connect"
    ) {
      onNodeClick(
        node.id
      );

      return;
    }

    if (
      tool !== "select" ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    onNodeClick(
      node.id
    );

    nodeDragRef.current = {
      pointerId:
        event.pointerId,

      nodeId:
        node.id,

      startX:
        event.clientX,

      startY:
        event.clientY,

      dragging:
        false,
    };

    try {
      event.currentTarget
        .setPointerCapture(
          event.pointerId
        );
    } catch {
      //
    }
  }


  function handleNodePointerMove(
    event,
    node
  ) {
    event.stopPropagation();

    const drag =
      nodeDragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId ||
      drag.nodeId !==
        node.id
    ) {
      return;
    }

    const dx =
      event.clientX -
      drag.startX;

    const dy =
      event.clientY -
      drag.startY;

    const distance =
      Math.hypot(
        dx,
        dy
      );

    if (
      !drag.dragging &&
      distance <
        DRAG_THRESHOLD
    ) {
      return;
    }

    if (
      !drag.dragging
    ) {
      drag.dragging =
        true;

      onNodeDragStart?.(
        node.id
      );
    }

    dragPointerRef.current = {
      clientX:
        event.clientX,

      clientY:
        event.clientY,
    };

    updateDraggedNodePosition();

    startAutoPan();
  }


  function updateDraggedNodePosition() {
    const drag =
      nodeDragRef.current;

    const pointer =
      dragPointerRef.current;

    if (
      !drag ||
      !drag.dragging ||
      !pointer
    ) {
      return;
    }

    const position =
      screenToWorld(
        pointer.clientX,
        pointer.clientY
      );

    const snapped =
      snapToGrid(
        position,
        mapData.gridSpacing
      );

    onNodeMove(
      drag.nodeId,
      snapped.x,
      snapped.y
    );
  }


  function handleNodePointerUp(
    event,
    node
  ) {
    event.stopPropagation();

    const drag =
      nodeDragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    if (
      drag.dragging
    ) {
      onNodeDragEnd?.(
        node.id
      );
    }

    stopAutoPan();

    nodeDragRef.current =
      null;

    dragPointerRef.current =
      null;

    try {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId
        );
    } catch {
      //
    }
  }


  function handleNodePointerCancel(
    event,
    node
  ) {
    event.stopPropagation();

    if (
      nodeDragRef.current
        ?.dragging
    ) {
      onNodeDragEnd?.(
        node.id
      );
    }

    stopAutoPan();

    nodeDragRef.current =
      null;
  }


  /*
   * =====================================================
   * AUTO PAN
   * =====================================================
   */

  function startAutoPan() {
    if (
      autoPanFrameRef.current
    ) {
      return;
    }

    function loop() {
      const drag =
        nodeDragRef.current;

      const pointer =
        dragPointerRef.current;

      if (
        !drag ||
        !drag.dragging ||
        !pointer
      ) {
        autoPanFrameRef.current =
          null;

        return;
      }

      const viewport =
        viewportRef.current;

      if (
        !viewport
      ) {
        return;
      }

      const rect =
        viewport.getBoundingClientRect();

      let dx = 0;
      let dy = 0;

      if (
        pointer.clientX -
          rect.left <
        AUTO_PAN_EDGE
      ) {
        dx =
          AUTO_PAN_SPEED;
      }

      if (
        rect.right -
          pointer.clientX <
        AUTO_PAN_EDGE
      ) {
        dx =
          -AUTO_PAN_SPEED;
      }

      if (
        pointer.clientY -
          rect.top <
        AUTO_PAN_EDGE
      ) {
        dy =
          AUTO_PAN_SPEED;
      }

      if (
        rect.bottom -
          pointer.clientY <
        AUTO_PAN_EDGE
      ) {
        dy =
          -AUTO_PAN_SPEED;
      }

      if (
        dx !== 0 ||
        dy !== 0
      ) {
        updatePan({
          x:
            panRef.current.x +
            dx,

          y:
            panRef.current.y +
            dy,
        });

        updateDraggedNodePosition();
      }

      autoPanFrameRef.current =
        requestAnimationFrame(
          loop
        );
    }

    autoPanFrameRef.current =
      requestAnimationFrame(
        loop
      );
  }


  function stopAutoPan() {
    dragPointerRef.current =
      null;

    if (
      autoPanFrameRef.current
    ) {
      cancelAnimationFrame(
        autoPanFrameRef.current
      );

      autoPanFrameRef.current =
        null;
    }
  }


  /*
   * =====================================================
   * PATH CLICK
   * =====================================================
   */

  function handleEdgePointerDown(
    event,
    edge
  ) {
    event.stopPropagation();

    if (
      mode !== "edit" ||
      tool !== "select" ||
      event.button !== 0
    ) {
      return;
    }

    onEdgeClick(
      edge.id
    );
  }


  /*
   * =====================================================
   * V11 - BOUNDARY
   * =====================================================
   */

  function handleBoundaryPointerDown(
    event,
    action
  ) {
    event.stopPropagation();

    if (
      mode !== "edit" ||
      tool !== "select" ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    onBoundaryClick?.();

    const start =
      screenToWorld(
        event.clientX,
        event.clientY
      );

    boundaryDragRef.current = {
      pointerId:
        event.pointerId,

      action,

      startX:
        start.x,

      startY:
        start.y,

      originX:
        Number(
          mapData.originX
        ) || 0,

      originY:
        Number(
          mapData.originY
        ) || 0,

      width:
        Number(
          mapData.width
        ) || 1,

      height:
        Number(
          mapData.height
        ) || 1,

      started:
        false,
    };

    try {
      event.currentTarget
        .setPointerCapture(
          event.pointerId
        );
    } catch {
      //
    }
  }


  function handleBoundaryPointerMove(
    event
  ) {
    event.stopPropagation();

    const drag =
      boundaryDragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const current =
      screenToWorld(
        event.clientX,
        event.clientY
      );

    const dx =
      current.x -
      drag.startX;

    const dy =
      current.y -
      drag.startY;

    if (
      !drag.started &&
      Math.hypot(
        dx,
        dy
      ) <
        DRAG_THRESHOLD /
          SCALE /
          zoom
    ) {
      return;
    }

    if (
      !drag.started
    ) {
      drag.started =
        true;

      onBoundaryDragStart?.();
    }


    let originX =
      drag.originX;

    let originY =
      drag.originY;

    let width =
      drag.width;

    let height =
      drag.height;


    if (
      drag.action === "MOVE"
    ) {
      originX =
        drag.originX +
        dx;

      originY =
        drag.originY +
        dy;
    }


    if (
      drag.action.includes(
        "E"
      )
    ) {
      width =
        drag.width +
        dx;
    }


    if (
      drag.action.includes(
        "S"
      )
    ) {
      height =
        drag.height +
        dy;
    }


    if (
      drag.action.includes(
        "W"
      )
    ) {
      originX =
        drag.originX +
        dx;

      width =
        drag.width -
        dx;
    }


    if (
      drag.action.includes(
        "N"
      )
    ) {
      originY =
        drag.originY +
        dy;

      height =
        drag.height -
        dy;
    }


    /*
     * Minimum size
     */

    if (
      width <
      MIN_BOUNDARY_SIZE
    ) {
      if (
        drag.action.includes(
          "W"
        )
      ) {
        originX =
          drag.originX +
          drag.width -
          MIN_BOUNDARY_SIZE;
      }

      width =
        MIN_BOUNDARY_SIZE;
    }


    if (
      height <
      MIN_BOUNDARY_SIZE
    ) {
      if (
        drag.action.includes(
          "N"
        )
      ) {
        originY =
          drag.originY +
          drag.height -
          MIN_BOUNDARY_SIZE;
      }

      height =
        MIN_BOUNDARY_SIZE;
    }


    if (
      mapData.snapBoundaryToGrid
    ) {
      const spacing =
        Number(
          mapData.gridSpacing
        ) || 1;

      originX =
        snapNumber(
          originX,
          spacing
        );

      originY =
        snapNumber(
          originY,
          spacing
        );

      width =
        Math.max(
          MIN_BOUNDARY_SIZE,
          snapNumber(
            width,
            spacing
          )
        );

      height =
        Math.max(
          MIN_BOUNDARY_SIZE,
          snapNumber(
            height,
            spacing
          )
        );
    }


    onBoundaryChange?.({
      originX:
        Number(
          originX.toFixed(
            3
          )
        ),

      originY:
        Number(
          originY.toFixed(
            3
          )
        ),

      width:
        Number(
          width.toFixed(
            3
          )
        ),

      height:
        Number(
          height.toFixed(
            3
          )
        ),
    });
  }


  function handleBoundaryPointerUp(
    event
  ) {
    event.stopPropagation();

    const drag =
      boundaryDragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    if (
      drag.started
    ) {
      onBoundaryDragEnd?.();
    }

    boundaryDragRef.current =
      null;

    try {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId
        );
    } catch {
      //
    }
  }


  /*
   * =====================================================
   * MONITOR
   * =====================================================
   */

  const selectedRobot =
    robots.find(
      (robot) =>
        robot.id ===
        selectedRobotId
    ) || null;


  const selectedRobotPath =
    selectedRobot?.plannedPath ||
    [];


  /*
   * =====================================================
   * GRID
   * =====================================================
   */

  const gridSize =
    Math.max(
      Number(
        mapData.gridSpacing
      ) || 1,
      0.01
    ) *
    SCALE *
    zoom;


  /*
   * =====================================================
   * MINI MAP
   * =====================================================
   */

  const miniBounds =
    calculateMapBounds(
      mapData,
      true
    );


  const miniTransform =
    calculateMiniTransform(
      miniBounds
    );


  function worldToMini(
    x,
    y
  ) {
    return {
      x:
        MINI_PADDING +
        (
          x -
          miniBounds.minX
        ) *
        miniTransform.scale,

      y:
        MINI_PADDING +
        (
          y -
          miniBounds.minY
        ) *
        miniTransform.scale,
    };
  }


  function handleMiniMapClick(
    event
  ) {
    event.stopPropagation();

    const rect =
      event.currentTarget
        .getBoundingClientRect();

    const localX =
      event.clientX -
      rect.left;

    const localY =
      event.clientY -
      rect.top;

    const worldX =
      miniBounds.minX +
      (
        localX -
        MINI_PADDING
      ) /
      miniTransform.scale;

    const worldY =
      miniBounds.minY +
      (
        localY -
        MINI_PADDING
      ) /
      miniTransform.scale;

    const viewport =
      viewportRef.current;

    if (
      !viewport
    ) {
      return;
    }

    const viewportRect =
      viewport.getBoundingClientRect();

    updatePan({
      x:
        viewportRect.width /
          2 -
        worldX *
          SCALE *
          zoom,

      y:
        viewportRect.height /
          2 -
        worldY *
          SCALE *
          zoom,
    });
  }


  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  const boundaryX =
    (
      Number(
        mapData.originX
      ) || 0
    ) *
    SCALE;

  const boundaryY =
    (
      Number(
        mapData.originY
      ) || 0
    ) *
    SCALE;

  const boundaryWidth =
    Number(
      mapData.width
    ) *
    SCALE;

  const boundaryHeight =
    Number(
      mapData.height
    ) *
    SCALE;


  return (
    <div
      ref={
        viewportRef
      }

      className={`map-canvas-wrapper tool-${tool}`}

      onPointerDown={
        handleBackgroundPointerDown
      }

      onPointerMove={
        handleBackgroundPointerMove
      }

      onPointerUp={
        handleBackgroundPointerUp
      }

      onWheel={
        handleWheel
      }
    >
      <div
        className="infinite-map-background"

        style={{
          "--grid-size":
            `${gridSize}px`,

          "--grid-x":
            `${positiveModulo(
              pan.x,
              gridSize
            )}px`,

          "--grid-y":
            `${positiveModulo(
              pan.y,
              gridSize
            )}px`,
        }}
      />


      <svg
        className="infinite-map-world"
      >
        <defs>
          <marker
            id="path-arrow"

            markerWidth="8"
            markerHeight="8"

            refX="7"
            refY="4"

            orient="auto"

            markerUnits="strokeWidth"
          >
            <path
              d="M 0 0 L 8 4 L 0 8 z"

              className="path-arrow-head"
            />
          </marker>
        </defs>


        <g
          transform={`
            translate(
              ${pan.x}
              ${pan.y}
            )

            scale(
              ${zoom}
            )
          `}
        >
          {/* =========================================
              WAREHOUSE BOUNDARY
          ========================================= */}

          {mapData.showBoundary && (
            <>
              <rect
                x={
                  boundaryX
                }

                y={
                  boundaryY
                }

                width={
                  boundaryWidth
                }

                height={
                  boundaryHeight
                }

                className={`warehouse-boundary ${
                  boundarySelected
                    ? "selected"
                    : ""
                }`}

                onPointerDown={(event) =>
                  handleBoundaryPointerDown(
                    event,
                    "MOVE"
                  )
                }

                onPointerMove={
                  handleBoundaryPointerMove
                }

                onPointerUp={
                  handleBoundaryPointerUp
                }
              />


              {boundarySelected &&
                mode === "edit" &&
                tool ===
                  "select" && (
                <BoundaryHandles
                  x={
                    boundaryX
                  }

                  y={
                    boundaryY
                  }

                  width={
                    boundaryWidth
                  }

                  height={
                    boundaryHeight
                  }

                  onPointerDown={
                    handleBoundaryPointerDown
                  }

                  onPointerMove={
                    handleBoundaryPointerMove
                  }

                  onPointerUp={
                    handleBoundaryPointerUp
                  }
                />
              )}
            </>
          )}


          {/* =========================================
              PATHS
          ========================================= */}

          {mapData.edges.map(
            (edge) => {
              const from =
                mapData.nodes.find(
                  (node) =>
                    node.id ===
                    edge.from
                );

              const to =
                mapData.nodes.find(
                  (node) =>
                    node.id ===
                    edge.to
                );

              if (
                !from ||
                !to
              ) {
                return null;
              }

              const x1 =
                from.x *
                SCALE;

              const y1 =
                from.y *
                SCALE;

              const x2 =
                to.x *
                SCALE;

              const y2 =
                to.y *
                SCALE;

              const selected =
                mode === "edit" &&
                selectedEdgeId ===
                  edge.id;

              const highlighted =
                mode === "monitor" &&
                isEdgeInRobotPath(
                  edge,
                  selectedRobotPath
                );

              const pathType =
                edge.pathType ||
                "NORMAL";


              return (
                <g
                  key={
                    edge.id
                  }

                  className="map-edge-group"
                >
                  {mode === "edit" && (
                    <line
                      x1={x1}
                      y1={y1}

                      x2={x2}
                      y2={y2}

                      className="map-edge-hitbox"

                      onPointerDown={(event) =>
                        handleEdgePointerDown(
                          event,
                          edge
                        )
                      }

                      onPointerUp={(event) =>
                        event.stopPropagation()
                      }
                    />
                  )}


                  <line
                    x1={x1}
                    y1={y1}

                    x2={x2}
                    y2={y2}

                    markerEnd={
                      !edge.bidirectional
                        ? "url(#path-arrow)"
                        : undefined
                    }

                    className={[
                      "map-edge",

                      `path-type-${pathType.toLowerCase()}`,

                      selected
                        ? "selected"
                        : "",

                      highlighted
                        ? "path-highlighted"
                        : "",

                      edge.enabled ===
                        false
                        ? "disabled"
                        : "",
                    ].join(" ")}
                  />


                  <text
                    x={
                      (
                        x1 +
                        x2
                      ) /
                      2
                    }

                    y={
                      (
                        y1 +
                        y2
                      ) /
                        2 -
                      9
                    }

                    textAnchor="middle"

                    className="edge-distance"
                  >
                    {edge.id}
                    {" • "}
                    {Number(
                      edge.distance
                    ).toFixed(2)}
                    {" m"}
                  </text>
                </g>
              );
            }
          )}


          {/* =========================================
              NODES
          ========================================= */}

          {mapData.nodes.map(
            (node) => (
              <NodeShape
                key={
                  node.id
                }

                node={
                  node
                }

                selected={
                  mode ===
                    "edit" &&
                  selectedNodeId ===
                    node.id
                }

                connecting={
                  mode ===
                    "edit" &&
                  connectionStart ===
                    node.id
                }

                onPointerDown={(event) =>
                  handleNodePointerDown(
                    event,
                    node
                  )
                }

                onPointerMove={(event) =>
                  handleNodePointerMove(
                    event,
                    node
                  )
                }

                onPointerUp={(event) =>
                  handleNodePointerUp(
                    event,
                    node
                  )
                }

                onPointerCancel={(event) =>
                  handleNodePointerCancel(
                    event,
                    node
                  )
                }
              />
            )
          )}


          {/* =========================================
              ROBOTS
          ========================================= */}

          {mode === "monitor" &&
            robots.map(
              (robot) => (
                <g
                  key={
                    robot.id
                  }

                  className="monitor-robot"

                  transform={`
                    translate(
                      ${
                        robot.x *
                        SCALE
                      }
                      ${
                        robot.y *
                        SCALE
                      }
                    )
                  `}

                  onPointerDown={(event) => {
                    event.stopPropagation();

                    onRobotClick(
                      robot.id
                    );
                  }}
                >
                  <circle
                    r={
                      selectedRobotId ===
                      robot.id
                        ? 16
                        : 13
                    }

                    className={[
                      "monitor-robot-body",

                      `status-${robot.status.toLowerCase()}`,

                      selectedRobotId ===
                      robot.id
                        ? "selected"
                        : "",
                    ].join(" ")}
                  />

                  <text
                    x="0"
                    y="4"

                    textAnchor="middle"

                    className="monitor-robot-symbol"
                  >
                    R
                  </text>

                  <text
                    x="0"
                    y="-20"

                    textAnchor="middle"

                    className="monitor-robot-label"
                  >
                    {robot.id}
                  </text>
                </g>
              )
            )}
        </g>
      </svg>


      <div
        className="map-origin-marker"

        style={{
          left:
            pan.x,

          top:
            pan.y,
        }}
      >
        <span>
          0,0
        </span>
      </div>


      {/* =============================================
          V11 MINI MAP
      ============================================= */}

      <MiniMap
        mapData={
          mapData
        }

        bounds={
          miniBounds
        }

        transform={
          miniTransform
        }

        worldToMini={
          worldToMini
        }

        pan={
          pan
        }

        zoom={
          zoom
        }

        viewportRef={
          viewportRef
        }

        onClick={
          handleMiniMapClick
        }
      />
    </div>
  );
}


/* =====================================================
   BOUNDARY HANDLES
===================================================== */

function BoundaryHandles({
  x,
  y,
  width,
  height,

  onPointerDown,
  onPointerMove,
  onPointerUp,
}) {
  const size = 10;

  const handles = [
    {
      action: "NW",
      x,
      y,
    },
    {
      action: "N",
      x:
        x +
        width / 2,
      y,
    },
    {
      action: "NE",
      x:
        x +
        width,
      y,
    },
    {
      action: "E",
      x:
        x +
        width,
      y:
        y +
        height / 2,
    },
    {
      action: "SE",
      x:
        x +
        width,
      y:
        y +
        height,
    },
    {
      action: "S",
      x:
        x +
        width / 2,
      y:
        y +
        height,
    },
    {
      action: "SW",
      x,
      y:
        y +
        height,
    },
    {
      action: "W",
      x,
      y:
        y +
        height / 2,
    },
  ];


  return (
    <g className="boundary-handles">
      {handles.map(
        (handle) => (
          <rect
            key={
              handle.action
            }

            x={
              handle.x -
              size / 2
            }

            y={
              handle.y -
              size / 2
            }

            width={
              size
            }

            height={
              size
            }

            rx="2"

            className={`boundary-resize-handle handle-${handle.action.toLowerCase()}`}

            onPointerDown={(event) =>
              onPointerDown(
                event,
                handle.action
              )
            }

            onPointerMove={
              onPointerMove
            }

            onPointerUp={
              onPointerUp
            }
          />
        )
      )}
    </g>
  );
}


/* =====================================================
   MINI MAP
===================================================== */

function MiniMap({
  mapData,
  bounds,
  transform,
  worldToMini,
  pan,
  zoom,
  viewportRef,
  onClick,
}) {
  const viewport =
    viewportRef.current;


  let viewportWorldX =
    0;

  let viewportWorldY =
    0;

  let viewportWorldWidth =
    0;

  let viewportWorldHeight =
    0;


  if (
    viewport
  ) {
    const rect =
      viewport.getBoundingClientRect();

    viewportWorldX =
      -pan.x /
      zoom /
      SCALE;

    viewportWorldY =
      -pan.y /
      zoom /
      SCALE;

    viewportWorldWidth =
      rect.width /
      zoom /
      SCALE;

    viewportWorldHeight =
      rect.height /
      zoom /
      SCALE;
  }


  const viewportMini =
    worldToMini(
      viewportWorldX,
      viewportWorldY
    );


  return (
    <div
      className="map-minimap"

      onPointerDown={(event) =>
        event.stopPropagation()
      }

      onClick={
        onClick
      }
    >
      <div className="map-minimap-title">
        MINI MAP
      </div>


      <svg
        width={
          MINI_WIDTH
        }

        height={
          MINI_HEIGHT
        }

        viewBox={`0 0 ${MINI_WIDTH} ${MINI_HEIGHT}`}
      >
        <rect
          x="0"
          y="0"

          width={
            MINI_WIDTH
          }

          height={
            MINI_HEIGHT
          }

          className="minimap-background"
        />


        {mapData.showBoundary && (
          <MiniBoundary
            mapData={
              mapData
            }

            worldToMini={
              worldToMini
            }

            scale={
              transform.scale
            }
          />
        )}


        {mapData.edges.map(
          (edge) => {
            const from =
              mapData.nodes.find(
                (node) =>
                  node.id ===
                  edge.from
              );

            const to =
              mapData.nodes.find(
                (node) =>
                  node.id ===
                  edge.to
              );

            if (
              !from ||
              !to
            ) {
              return null;
            }

            const p1 =
              worldToMini(
                from.x,
                from.y
              );

            const p2 =
              worldToMini(
                to.x,
                to.y
              );

            return (
              <line
                key={
                  edge.id
                }

                x1={
                  p1.x
                }

                y1={
                  p1.y
                }

                x2={
                  p2.x
                }

                y2={
                  p2.y
                }

                className="minimap-path"
              />
            );
          }
        )}


        {mapData.nodes.map(
          (node) => {
            const point =
              worldToMini(
                node.x,
                node.y
              );

            return (
              <circle
                key={
                  node.id
                }

                cx={
                  point.x
                }

                cy={
                  point.y
                }

                r="2.5"

                className="minimap-node"
              />
            );
          }
        )}


        <rect
          x={
            viewportMini.x
          }

          y={
            viewportMini.y
          }

          width={
            viewportWorldWidth *
            transform.scale
          }

          height={
            viewportWorldHeight *
            transform.scale
          }

          className="minimap-viewport"
        />
      </svg>
    </div>
  );
}


function MiniBoundary({
  mapData,
  worldToMini,
  scale,
}) {
  const origin =
    worldToMini(
      Number(
        mapData.originX
      ) || 0,

      Number(
        mapData.originY
      ) || 0
    );


  return (
    <rect
      x={
        origin.x
      }

      y={
        origin.y
      }

      width={
        Number(
          mapData.width
        ) *
        scale
      }

      height={
        Number(
          mapData.height
        ) *
        scale
      }

      className="minimap-boundary"
    />
  );
}


/* =====================================================
   NODE SHAPE
===================================================== */

function NodeShape({
  node,

  selected,
  connecting,

  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) {
  const x =
    node.x *
    SCALE;

  const y =
    node.y *
    SCALE;


  const classes = [
    "map-node-shape",

    `node-type-${node.type.toLowerCase()}`,

    selected
      ? "selected"
      : "",

    connecting
      ? "connecting"
      : "",

    node.enabled === false
      ? "disabled"
      : "",
  ].join(" ");


  if (
    node.type ===
    "STORAGE"
  ) {
    const width =
      Number(
        node.config?.width ||
          4
      ) *
      SCALE;

    const depth =
      Number(
        node.config?.depth ||
          2
      ) *
      SCALE;

    return (
      <g
        className="map-node-group"

        transform={`
          translate(
            ${x}
            ${y}
          )

          rotate(
            ${
              node.rotation ||
              0
            }
          )
        `}

        onPointerDown={
          onPointerDown
        }

        onPointerMove={
          onPointerMove
        }

        onPointerUp={
          onPointerUp
        }

        onPointerCancel={
          onPointerCancel
        }
      >
        <rect
          x={
            -width / 2
          }

          y={
            -depth / 2
          }

          width={
            width
          }

          height={
            depth
          }

          rx="5"

          className={
            classes
          }
        />

        <LocalNodeLabel
          node={
            node
          }
        />
      </g>
    );
  }


  if (
    node.type ===
      "CHARGING" ||
    node.type ===
      "DOCK"
  ) {
    const width =
      Number(
        node.config?.width ||
          2
      ) *
      SCALE;

    const depth =
      Number(
        node.config?.depth ||
          2
      ) *
      SCALE;

    return (
      <g
        className="map-node-group"

        transform={`
          translate(
            ${x}
            ${y}
          )

          rotate(
            ${
              node.rotation ||
              0
            }
          )
        `}

        onPointerDown={
          onPointerDown
        }

        onPointerMove={
          onPointerMove
        }

        onPointerUp={
          onPointerUp
        }

        onPointerCancel={
          onPointerCancel
        }
      >
        <rect
          x={
            -width /
            2
          }

          y={
            -depth /
            2
          }

          width={
            width
          }

          height={
            depth
          }

          rx="7"

          className={
            classes
          }
        />

        <text
          x="0"
          y="4"

          textAnchor="middle"

          className="node-type-symbol"
        >
          {node.type ===
          "CHARGING"
            ? "⚡"
            : "D"}
        </text>

        <LocalNodeLabel
          node={
            node
          }
        />
      </g>
    );
  }


  if (
    node.type ===
    "ROAD"
  ) {
    return (
      <g
        className="map-node-group"

        transform={`
          translate(
            ${x}
            ${y}
          )

          rotate(
            ${
              45 +
              (
                node.rotation ||
                0
              )
            }
          )
        `}

        onPointerDown={
          onPointerDown
        }

        onPointerMove={
          onPointerMove
        }

        onPointerUp={
          onPointerUp
        }

        onPointerCancel={
          onPointerCancel
        }
      >
        <rect
          x="-10"
          y="-10"

          width="20"
          height="20"

          rx="3"

          className={
            classes
          }
        />
      </g>
    );
  }


  if (
    node.type ===
      "PICKUP" ||
    node.type ===
      "DROPOFF"
  ) {
    const points =
      node.type ===
      "PICKUP"
        ? "-12,10 0,-12 12,10"
        : "-12,-10 0,12 12,-10";

    return (
      <g
        className="map-node-group"

        transform={`
          translate(
            ${x}
            ${y}
          )
        `}

        onPointerDown={
          onPointerDown
        }

        onPointerMove={
          onPointerMove
        }

        onPointerUp={
          onPointerUp
        }

        onPointerCancel={
          onPointerCancel
        }
      >
        <polygon
          points={
            points
          }

          className={
            classes
          }
        />

        <LocalNodeLabel
          node={
            node
          }
        />
      </g>
    );
  }


  return (
    <g
      className="map-node-group"

      onPointerDown={
        onPointerDown
      }

      onPointerMove={
        onPointerMove
      }

      onPointerUp={
        onPointerUp
      }

      onPointerCancel={
        onPointerCancel
      }
    >
      <circle
        cx={
          x
        }

        cy={
          y
        }

        r={
          selected ||
          connecting
            ? 10
            : 8
        }

        className={
          classes
        }
      />

      {node.type ===
        "HOME" && (
        <text
          x={x}
          y={
            y + 3
          }

          textAnchor="middle"

          className="node-type-symbol"
        >
          H
        </text>
      )}

      <text
        x={x}
        y={
          y - 15
        }

        textAnchor="middle"

        className="map-node-label"
      >
        {node.id}
      </text>
    </g>
  );
}


function LocalNodeLabel({
  node,
}) {
  return (
    <text
      x="0"
      y="-18"

      textAnchor="middle"

      className="map-node-label"
    >
      {node.id}
    </text>
  );
}


/* =====================================================
   HELPERS
===================================================== */

function calculateMapBounds(
  mapData,
  addPadding = false
) {
  const originX =
    Number(
      mapData.originX
    ) || 0;

  const originY =
    Number(
      mapData.originY
    ) || 0;

  const width =
    Number(
      mapData.width
    ) || 1;

  const height =
    Number(
      mapData.height
    ) || 1;


  let minX =
    originX;

  let minY =
    originY;

  let maxX =
    originX +
    width;

  let maxY =
    originY +
    height;


  for (
    const node
    of mapData.nodes
  ) {
    let halfWidth =
      0.5;

    let halfDepth =
      0.5;


    if (
      [
        "STORAGE",
        "CHARGING",
        "DOCK",
      ].includes(
        node.type
      )
    ) {
      halfWidth =
        (
          Number(
            node.config?.width
          ) || 1
        ) /
        2;

      halfDepth =
        (
          Number(
            node.config?.depth
          ) || 1
        ) /
        2;
    }


    minX =
      Math.min(
        minX,
        node.x -
          halfWidth
      );

    maxX =
      Math.max(
        maxX,
        node.x +
          halfWidth
      );

    minY =
      Math.min(
        minY,
        node.y -
          halfDepth
      );

    maxY =
      Math.max(
        maxY,
        node.y +
          halfDepth
      );
  }


  if (
    addPadding
  ) {
    const padding =
      Math.max(
        (
          maxX -
          minX
        ) *
          0.1,
        2
      );

    minX -=
      padding;

    minY -=
      padding;

    maxX +=
      padding;

    maxY +=
      padding;
  }


  return {
    minX,
    minY,
    maxX,
    maxY,
  };
}


function calculateMiniTransform(
  bounds
) {
  const width =
    Math.max(
      bounds.maxX -
        bounds.minX,
      1
    );

  const height =
    Math.max(
      bounds.maxY -
        bounds.minY,
      1
    );


  return {
    scale:
      Math.min(
        (
          MINI_WIDTH -
          MINI_PADDING * 2
        ) /
          width,

        (
          MINI_HEIGHT -
          MINI_PADDING * 2
        ) /
          height
      ),
  };
}


function snapToGrid(
  position,
  spacing
) {
  const step =
    Number(
      spacing
    );

  if (
    !Number.isFinite(
      step
    ) ||
    step <= 0
  ) {
    return position;
  }

  return {
    x:
      snapNumber(
        position.x,
        step
      ),

    y:
      snapNumber(
        position.y,
        step
      ),
  };
}


function snapNumber(
  value,
  step
) {
  return Number(
    (
      Math.round(
        Number(value) /
          step
      ) *
      step
    ).toFixed(3)
  );
}


function clamp(
  value,
  min,
  max
) {
  return Math.min(
    Math.max(
      Number(value),
      min
    ),
    max
  );
}


function positiveModulo(
  value,
  divisor
) {
  if (
    !Number.isFinite(
      divisor
    ) ||
    divisor <= 0
  ) {
    return 0;
  }

  return (
    (
      value %
      divisor
    ) +
    divisor
  ) %
  divisor;
}


function isEdgeInRobotPath(
  edge,
  path
) {
  if (
    !path ||
    path.length < 2
  ) {
    return false;
  }

  for (
    let index = 0;
    index <
    path.length - 1;
    index++
  ) {
    const from =
      path[index];

    const to =
      path[
        index + 1
      ];

    if (
      (
        edge.from ===
          from &&
        edge.to ===
          to
      ) ||
      (
        edge.from ===
          to &&
        edge.to ===
          from
      )
    ) {
      return true;
    }
  }

  return false;
}