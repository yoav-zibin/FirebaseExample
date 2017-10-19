module dragAndDrop {
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

  function init() {
    let currentElement: HTMLElement = null;
    let currentZIndex = 100;

    function endDrag() {
      if (currentElement != null) {
        currentElement.classList.remove('currentlyDragged');
        currentElement = null;
      }
    }

    function touchHandler(type: string, clientX: number, clientY: number, event: TouchEvent | MouseEvent) {
      if (type == "touchstart") {
        endDrag();
        currentElement = <HTMLElement> document.elementFromPoint(clientX, clientY);
        if (!currentElement.classList.contains('draggable')) {
          currentElement = null;
        } else {
          currentElement.classList.add('currentlyDragged');
        }
      }
      if (currentElement != null) {
        currentElement.style.left = (clientX - currentElement.offsetWidth/2) + 'px';
        currentElement.style.top = (clientY - currentElement.offsetHeight/2) + 'px';
        currentElement.style.zIndex = '' + (++currentZIndex);
      }
      if (type == "touchend") {
        endDrag();
      }
    }

    addDragListener('draggableArea', touchHandler);
  }

  init();
}