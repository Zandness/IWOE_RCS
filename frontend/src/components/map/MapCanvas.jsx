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

  const panStart =
    useRef(null);

  const SCALE = 30;

  const canvasWidth =
    mapData.width * SCALE;

  const canvasHeight =
    mapData.height * SCALE;

  function getMousePosition(event) {
    const svg = svgRef.current;

    if (!svg) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      svg.getBoundingClientRect();

    const pixelX =
      ((event.clientX -
        rect.left -
        pan.x) /
        zoom);

    const pixelY =
      ((event.clientY -
        rect.top -
        pan.y) /
        zoom);

    return {
      x: Number(
        (
          (pixelX /
            rect.width) *
          mapData.width
        ).toFixed(2)
      ),

      y: Number(
        (
          (pixelY /
            rect.height) *
          mapData.height
        ).toFixed(2)
      ),
    };
  }

  function handleBackgroundClick(event) {
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

    if (
      panStart.current
    ) {
      return;
    }

    const position =
      getMousePosition(event);

    onCanvasClick(position);
  }

  /*
   * =========================
   * PAN
   * =========================
   */

  function handleCanvasMouseDown(event) {
    if (
      tool !== "select"
    ) {
      return;
    }

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

    panStart.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,

      panX: pan.x,
      panY: pan.y,
    };

    function handleMove(moveEvent) {
      if (!panStart.current) return;

      const dx =
        moveEvent.clientX -
        panStart.current.mouseX;

      const dy =
        moveEvent.clientY -
        panStart.current.mouseY;

      setPan({
        x:
          panStart.current.panX +
          dx,

        y:
          panStart.current.panY +
          dy,
      });
    }

    function handleUp() {
      panStart.current = null;

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
   * =========================
   * MOUSE WHEEL ZOOM
   * =========================
   */

  function handleWheel(event) {
    event.preventDefault();

    const delta =
      event.deltaY < 0
        ? 0.1
        : -0.1;

    const nextZoom =
      Math.min(
        Math.max(
          zoom + delta,
          0.4
        ),
        2.5
      );

    onZoomChange(nextZoom);
  }

  /*
   * =========================
   * NODE DRAG
   * =========================
   */

  function handleNodeMouseDown(
    event,
    node
  ) {
    event.stopPropagation();

    if (
      tool !== "select"
    ) {
      onNodeClick(node.id);
      return;
    }

    onNodeClick(node.id);

    onNodeDragStart?.(
      node.id
    );

    function handleMove(moveEvent) {
      const position =
        getMousePosition(
          moveEvent
        );

      const snapped =
        snapToGrid(
          position,
          mapData.gridSpacing
        );

      onNodeMove(
        node.id,
        snapped.x,
        snapped.y
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
   * =========================
   * OBJECT DRAG
   * =========================
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

    onObjectClick({
      type,
      id: object.id,
    });

    onObjectDragStart?.(
      type,
      object.id
    );

    function handleMove(moveEvent) {
      const position =
        getMousePosition(
          moveEvent
        );

      const snapped =
        snapToGrid(
          position,
          mapData.gridSpacing
        );

      onObjectMove(
        type,
        object.id,
        snapped.x,
        snapped.y
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

  return (
    <div
      className="map-canvas-wrapper"
      onWheel={handleWheel}
    >
      <div
        className="map-transform-layer"
        style={{
          transform: `
            translate(${pan.x}px, ${pan.y}px)
            scale(${zoom})
          `,
        }}
      >
        <svg
          ref={svgRef}

          className={`map-editor-canvas tool-${tool}`}

          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}

          onClick={
            handleBackgroundClick
          }

          onMouseDown={
            handleCanvasMouseDown
          }
        >
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

          {/* RACKS */}

          {mapData.racks.map(
            (rack) => {
              const selected =
                selectedObject?.type ===
                  "rack" &&
                selectedObject?.id ===
                  rack.id;

              return (
                <g
                  key={rack.id}

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

                    className={`map-rack ${
                      selected
                        ? "selected"
                        : ""
                    }`}
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

          {/* STATIONS */}

          {mapData.stations.map(
            (station) => {
              const selected =
                selectedObject?.type ===
                  "station" &&
                selectedObject?.id ===
                  station.id;

              return (
                <g
                  key={station.id}

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

          {/* EDGES */}

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
                  key={edge.id}
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
                    {edge.distance.toFixed(2)} m
                  </text>
                </g>
              );
            }
          )}

          {/* NODES */}

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
                  key={node.id}

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
        key={`v-${x}`}
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
        key={`h-${y}`}
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