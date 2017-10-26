function addDragListener(touchElementId: string,
  handleDragEvent: (type: string, clientX: number, clientY: number, event: TouchEvent | MouseEvent) => void) {
  if (!touchElementId || !handleDragEvent) {
    throw new Error("When calling addDragListener(touchElementId, handleDragEvent), you must pass two parameters");
  }

  let isMouseDown = false;

  function touchHandler(event: TouchEvent) {
    let touch = event.changedTouches[0];
    handleEvent(event, event.type, touch.clientX, touch.clientY);
  }

  function mouseDownHandler(event: MouseEvent) {
    isMouseDown = true;
    handleEvent(event, "touchstart", event.clientX, event.clientY);
  }

  function mouseMoveHandler(event: MouseEvent) {
    if (isMouseDown) {
      handleEvent(event, "touchmove", event.clientX, event.clientY);
    }
  }

  function mouseUpHandler(event: MouseEvent) {
    isMouseDown = false;
    handleEvent(event, "touchend", event.clientX, event.clientY);
  }

  function handleEvent(event: TouchEvent | MouseEvent, type: string, clientX: number, clientY: number) {
    // http://stackoverflow.com/questions/3413683/disabling-the-context-menu-on-long-taps-on-android
    // I also have:  touch-callout:none and user-select:none in main.css
    if (event.preventDefault) {
      event.preventDefault(); // Also prevents generating mouse events for touch.
    }
    if (event.stopPropagation) {
      event.stopPropagation();
    }
    event.cancelBubble = true;
    event.returnValue = false;
    console.log("handleDragEvent:", type, clientX, clientY);
    handleDragEvent(type, clientX, clientY, event);
  }

  let gameArea = document.getElementById(touchElementId);
  if (!gameArea) {
    throw new Error("You must have <div id='" + touchElementId + "'>...</div>");
  }
  gameArea.addEventListener("touchstart", touchHandler, true);
  gameArea.addEventListener("touchmove", touchHandler, true);
  gameArea.addEventListener("touchend", touchHandler, true);
  gameArea.addEventListener("touchcancel", touchHandler, true);
  gameArea.addEventListener("touchleave", touchHandler, true);
  gameArea.addEventListener("mousedown", mouseDownHandler, true);
  gameArea.addEventListener("mousemove", mouseMoveHandler, true);
  gameArea.addEventListener("mouseup", mouseUpHandler, true);
}

interface Piece {
  img: HTMLImageElement;
  // x and y are in "px" (not percentages, as in firebase DB)
  x: number;
  y: number;
  width: number;
  height: number;
  layer: any;
}
let pieces: Piece[] = [];
let currentlyDragged: Piece = null;
let concreteContainer = document.getElementById('concreteContainer');
let boundingRect = concreteContainer.getBoundingClientRect()
// create viewport
let viewport = new Concrete.Viewport({
  width: 1024,
  height: 512,
  container: concreteContainer
});

function addPiece(url: string, 
    x: number,
    y: number) {
  let img = new Image();
  img.crossOrigin = "Anonymous";
  // img.onload = () => {...}
  img.src = url;
  var layer = new Concrete.Layer();
  viewport.add(layer);
  layer.hit.registerKey(pieces.length);
  pieces.push({
    x: x,
    y: y,
    width: 50,
    height: 50,
    img: img,
    layer: layer,
  });
}
function initPieces() {
  for (let i = 0; i < 5; i++) {
    addPiece("imgs/chess_piece_white_queen.png", 10 + i*10, 10);
  }
  for (let i = 0; i < 2; i++) {
    addPiece("imgs/GreenPiece.png", 10 + i*20, 100);
  }
}

function drawPieces() {
  pieces.forEach(function(piece) {
    drawPiece(piece);
  });
  viewport.render();
  requestAnimationFrame(drawPieces);
}
requestAnimationFrame(drawPieces);

function drawPiece(piece: Piece) {
  let scene = piece.layer.scene,
    context = scene.context;
  scene.clear();
  context.drawImage(piece.img, piece.x, piece.y, piece.width, piece.height);
}

function initDragAndDrop() {
  function touchHandler(type: string, clientX: number, clientY: number, event: TouchEvent | MouseEvent) {
    if (type == "touchstart") {
      currentlyDragged = pieces[0];
      currentlyDragged.layer.moveToTop();
    }
    if (currentlyDragged != null) {
      let x = clientX - boundingRect.left - currentlyDragged.width / 2;
      let y = clientY - boundingRect.top - currentlyDragged.height / 2;
      currentlyDragged.x = x;
      currentlyDragged.y = y;
    }
    if (type == "touchend") {
      currentlyDragged = null;
    }
  }

  addDragListener('concreteContainer', touchHandler);
}

initPieces();
initDragAndDrop();