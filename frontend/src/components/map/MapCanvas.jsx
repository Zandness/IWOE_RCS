import {
  useRef,
  useState,
} from "react";

export default function MapCanvas({
  mapData,

  tool,

  selectedNodeId,
  selectedObject,

  connectionStart,

  zoom,
  onZoomChange,

  onCanvasClick,

  onNodeClick,
  onNodeMove,

  onNodeDragStart,
  onNodeDragEnd,

  onObjectClick,
  onObjectMove,

  onObjectDragStart,
  onObjectDragEnd,
}) {
  const svgRef = useRef(null);

  const [pan, setPan] =
    useState({
      x: 0,
      y: 0,
    });

  const panStartRef =
    useRef(null);

  const dragMovedRef =
    useRef(false);

  const SCALE = 30;

  const canvasWidth =
    mapData.width * SCALE;

  const canvasHeight =
    mapData.height * SCALE;

  /*
   * ========================================
   * SCREEN POSITION -> MAP COORDINATE
   * ========================================
   */

  function screenToMap(
    clientX,
    clientY
  ) {
    const svg =
      svgRef.current;

    if (!svg) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      svg.getBoundingClientRect();

    /*
     * SVG displayed size after zoom/pan.
     *
     * SVG viewBox still represents:
     * 0..canvasWidth
     * 0..canvasHeight
     */

    const normalizedX =
      (clientX -
        rect.left) /
      rect.width;

    const normalizedY =
      (clientY -
        rect.top) /
      rect.height;

    const svgX =
      normalizedX *
      canvasWidth;

    const svgY =
      normalizedY *
      canvasHeight;

    const mapX =
      svgX / SCALE;

    const mapY =
      svgY / SCALE;

    return {
      x: Number(
        mapX.toFixed(3)
      ),

      y: Number(
        mapY.toFixed(3)
      ),
    };
  }


  /*
   * ========================================
   * BACKGROUND CLICK
   * ========================================
   */

  function handleCanvasClick(
    event
  ) {
    if (
      dragMovedRef.current
    ) {
      dragMovedRef.current =
        false;

      return;
    }

    /*
     * Object clicks already stop
     * propagation.
     */

    const position =
      screenToMap(
        event.clientX,
        event.clientY
      );

    onCanvasClick(
      position
    );
  }


  /*
   * ========================================
   * PAN
   * ========================================
   */

  function handleCanvasMouseDown(
    event
  ) {
    /*
     * Pan only in Select mode.
     */

    if (
      tool !== "select"
    ) {
      return;
    }

    /*
     * Do not pan when clicking
     * Node / Rack / Station.
     */

    if (
      event.target.closest(
        ".map-node-group"
      ) ||
      event.target.closest(
        ".map-object"
      )
    ) {
      return;
    }

    event.preventDefault();

    panStartRef.current = {
      mouseX:
        event.clientX,

      mouseY:
        event.clientY,

      panX:
        pan.x,

      panY:
        pan.y,
    };

    dragMovedRef.current =
      false;

    function handleMove(
      moveEvent
    ) {
      if (
        !panStartRef.current
      ) {
        return;
      }

      const dx =
        moveEvent.clientX -
        panStartRef.current.mouseX;

      const dy =
        moveEvent.clientY -
        panStartRef.current.mouseY;

      if (
        Math.abs(dx) > 2 ||
        Math.abs(dy) > 2
      ) {
        dragMovedRef.current =
          true;
      }

      setPan({
        x:
          panStartRef.current.panX +
          dx,

        y:
          panStartRef.current.panY +
          dy,
      });
    }

    function handleUp() {
      panStartRef.current =
        null;

      window.removeEventListener(
        "mousemove",
        handleMove
      );

      window.removeEventListener(
        "mouseup",
        handleUp
      );
    }

    window.addEventListener(
      "mousemove",
      handleMove
    );

    window.addEventListener(
      "mouseup",
      handleUp
    );
  }


  /*
   * ========================================
   * MOUSE WHEEL ZOOM
   * ========================================
   */

  function handleWheel(
    event
  ) {
    event.preventDefault();

    const step =
      event.deltaY < 0
        ? 0.1
        : -0.1;

    const nextZoom =
      clamp(
        zoom + step,
        0.4,
        2.5
      );

    onZoomChange(
      Number(
        nextZoom.toFixed(2)
      )
    );
  }


  /*
   * ========================================
   * NODE DRAG
   * ========================================
   */

  function handleNodeMouseDown(
    event,
    node
  ) {
    event.stopPropagation();

    /*
     * Path mode:
     * clicking Node selects it
     * for connection.
     */

    if (
      tool !== "select"
    ) {
      onNodeClick(
        node.id
      );

      return;
    }

    event.preventDefault();

    onNodeClick(
      node.id
    );

    onNodeDragStart?.(
      node.id
    );

    dragMovedRef.current =
      false;

    function handleMove(
      moveEvent
    ) {
      const position =
        screenToMap(
          moveEvent.clientX,
          moveEvent.clientY
        );

      const snapped =
        snapToGrid(
          position,
          mapData.gridSpacing
        );

      dragMovedRef.current =
        true;

      onNodeMove(
        node.id,

        clamp(
          snapped.x,
          0,
          mapData.width
        ),

        clamp(
          snapped.y,
          0,
          mapData.height
        )
      );
    }

    function handleUp() {
      window.removeEventListener(
        "mousemove",
        handleMove
      );

      window.removeEventListener(
        "mouseup",
        handleUp
      );

      onNodeDragEnd?.(
        node.id
      );
    }

    window.addEventListener(
      "mousemove",
      handleMove
    );

    window.addEventListener(
      "mouseup",
      handleUp
    );
  }


  /*
   * ========================================
   * OBJECT DRAG
   * ========================================
   */

  function handleObjectMouseDown(
    event,
    type,
    object
  ) {
    event.stopPropagation();

    if (
      tool !== "select"
    ) {
      return;
    }

    event.preventDefault();

    onObjectClick({
      type,
      id:
        object.id,
    });

    onObjectDragStart?.(
      type,
      object.id
    );

    dragMovedRef.current =
      false;

    function handleMove(
      moveEvent
    ) {
      const position =
        screenToMap(
          moveEvent.clientX,
          moveEvent.clientY
        );

      const snapped =
        snapToGrid(
          position,
          mapData.gridSpacing
        );

      dragMovedRef.current =
        true;

      onObjectMove(
        type,
        object.id,

        clamp(
          snapped.x,
          0,
          mapData.width
        ),

        clamp(
          snapped.y,
          0,
          mapData.height
        )
      );
    }

    function handleUp() {
      window.removeEventListener(
        "mousemove",
        handleMove
      );

      window.removeEventListener(
        "mouseup",
        handleUp
      );

      onObjectDragEnd?.(
        type,
        object.id
      );
    }

    window.addEventListener(
      "mousemove",
      handleMove
    );

    window.addEventListener(
      "mouseup",
      handleUp
    );
  }


  /*
   * ========================================
   * UI
   * ========================================
   */

  return (
    <div
      className="map-canvas-wrapper"
      onWheel={
        handleWheel
      }
    >
      <div
        className="map-transform-layer"

        style={{
          transform:
            `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <svg
          ref={svgRef}

          className={`map-editor-canvas tool-${tool}`}

          viewBox={
            `0 0 ${canvasWidth} ${canvasHeight}`
          }

          onClick={
            handleCanvasClick
          }

          onMouseDown={
            handleCanvasMouseDown
          }
        >

          {/* ======================
              BACKGROUND
          ====================== */}

          <rect
            x="0"
            y="0"

            width={
              canvasWidth
            }

            height={
              canvasHeight
            }

            className="map-background"
          />


          {/* ======================
              GRID
          ====================== */}

          <Grid
            width={
              canvasWidth
            }

            height={
              canvasHeight
            }

            spacing={
              mapData.gridSpacing *
              SCALE
            }
          />


          {/* ======================
              RACKS
          ====================== */}

          {mapData.racks.map(
            (rack) => {
              const selected =
                selectedObject?.type ===
                  "rack" &&
                selectedObject?.id ===
                  rack.id;

              return (
                <g
                  key={
                    rack.id
                  }

                  className="map-object"

                  transform={`
                    translate(
                      ${rack.x * SCALE}
                      ${rack.y * SCALE}
                    )
                    rotate(
                      ${rack.rotation}
                    )
                  `}

                  onMouseDown={(
                    event
                  ) =>
                    handleObjectMouseDown(
                      event,
                      "rack",
                      rack
                    )
                  }
                >
                  <rect
                    x={
                      -(
                        rack.width *
                        SCALE
                      ) / 2
                    }

                    y={
                      -(
                        rack.depth *
                        SCALE
                      ) / 2
                    }

                    width={
                      rack.width *
                      SCALE
                    }

                    height={
                      rack.depth *
                      SCALE
                    }

                    rx="5"

                    className={
                      `map-rack ${
                        selected
                          ? "selected"
                          : ""
                      }`
                    }
                  />

                  <text
                    x="0"
                    y="4"

                    textAnchor="middle"

                    className="map-object-label"
                  >
                    {rack.name}
                  </text>
                </g>
              );
            }
          )}


          {/* ======================
              STATIONS
          ====================== */}

          {mapData.stations.map(
            (station) => {
              const selected =
                selectedObject?.type ===
                  "station" &&
                selectedObject?.id ===
                  station.id;

              return (
                <g
                  key={
                    station.id
                  }

                  className="map-object"

                  transform={`
                    translate(
                      ${station.x * SCALE}
                      ${station.y * SCALE}
                    )
                    rotate(
                      ${station.rotation}
                    )
                  `}

                  onMouseDown={(
                    event
                  ) =>
                    handleObjectMouseDown(
                      event,
                      "station",
                      station
                    )
                  }
                >
                  <rect
                    x={
                      -(
                        station.width *
                        SCALE
                      ) / 2
                    }

                    y={
                      -(
                        station.depth *
                        SCALE
                      ) / 2
                    }

                    width={
                      station.width *
                      SCALE
                    }

                    height={
                      station.depth *
                      SCALE
                    }

                    rx="6"

                    className={[
                      "map-station",

                      station.type ===
                      "CHARGING"
                        ? "charging"
                        : "dock",

                      selected
                        ? "selected"
                        : "",
                    ].join(" ")}
                  />

                  <text
                    x="0"
                    y="4"

                    textAnchor="middle"

                    className="map-object-label"
                  >
                    {station.name}
                  </text>
                </g>
              );
            }
          )}


          {/* ======================
              EDGES
          ====================== */}

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

              return (
                <g
                  key={
                    edge.id
                  }

                  className="map-edge-group"
                >
                  <line
                    x1={x1}
                    y1={y1}

                    x2={x2}
                    y2={y2}

                    className="map-edge"
                  />

                  <text
                    x={
                      (x1 + x2) /
                      2
                    }

                    y={
                      (y1 + y2) /
                        2 -
                      8
                    }

                    textAnchor="middle"

                    className="edge-distance"
                  >
                    {
                      edge.distance.toFixed(
                        2
                      )
                    }{" "}
                    m
                  </text>
                </g>
              );
            }
          )}


          {/* ======================
              NODES
          ====================== */}

          {mapData.nodes.map(
            (node) => {
              const selected =
                selectedNodeId ===
                node.id;

              const connecting =
                connectionStart ===
                node.id;

              return (
                <g
                  key={
                    node.id
                  }

                  className="map-node-group"

                  onMouseDown={(
                    event
                  ) =>
                    handleNodeMouseDown(
                      event,
                      node
                    )
                  }
                >
                  <circle
                    cx={
                      node.x *
                      SCALE
                    }

                    cy={
                      node.y *
                      SCALE
                    }

                    r={
                      selected ||
                      connecting
                        ? 10
                        : 8
                    }

                    className={[
                      "map-node-circle",

                      `node-${node.type.toLowerCase()}`,

                      selected
                        ? "selected"
                        : "",

                      connecting
                        ? "connecting"
                        : "",
                    ].join(" ")}
                  />

                  <text
                    x={
                      node.x *
                      SCALE
                    }

                    y={
                      node.y *
                        SCALE -
                      15
                    }

                    textAnchor="middle"

                    className="map-node-label"
                  >
                    {node.id}
                  </text>
                </g>
              );
            }
          )}

        </svg>
      </div>
    </div>
  );
}


/*
 * ========================================
 * GRID
 * ========================================
 */

function Grid({
  width,
  height,
  spacing,
}) {
  if (
    !spacing ||
    spacing <= 0
  ) {
    return null;
  }

  const lines = [];

  for (
    let x = 0;
    x <= width;
    x += spacing
  ) {
    lines.push(
      <line
        key={`vertical-${x}`}

        x1={x}
        y1="0"

        x2={x}
        y2={height}

        className="grid-line"
      />
    );
  }

  for (
    let y = 0;
    y <= height;
    y += spacing
  ) {
    lines.push(
      <line
        key={`horizontal-${y}`}

        x1="0"
        y1={y}

        x2={width}
        y2={y}

        className="grid-line"
      />
    );
  }

  return (
    <g className="grid-layer">
      {lines}
    </g>
  );
}


/*
 * ========================================
 * GRID SNAP
 * ========================================
 */

function snapToGrid(
  position,
  spacing
) {
  if (
    !spacing ||
    spacing <= 0
  ) {
    return position;
  }

  return {
    x:
      Math.round(
        position.x /
          spacing
      ) *
      spacing,

    y:
      Math.round(
        position.y /
          spacing
      ) *
      spacing,
  };
}


/*
 * ========================================
 * CLAMP
 * ========================================
 */

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