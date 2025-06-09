/*
 * jQuery FlexSlider v2.7.1
 * Copyright 2012 WooThemes
 * Contributing Author: Tyler Smith
 *
 * व्हाट्स गोइंग ऑन (What's going on) - This is the FlexSlider jQuery plugin.
 * It's a third-party library used for creating responsive and flexible slideshows/carousels.
 * Comments below are added for understanding its structure and functionality.
 */

// IIFE (Immediately Invoked Function Expression) to create a private scope
// and pass jQuery as '$' to avoid conflicts with other libraries.
;(function ($) {

  // Global variable to track if the window has focus, used for pauseInvisible feature.
  var focused = true;

  // FlexSlider: Object Instance
  // This is the main constructor for the FlexSlider object.
  // el: The DOM element the slider will be attached to.
  // options: User-defined options to override defaults.
  $.flexslider = function(el, options) {
    var slider = $(el); // jQuery object for the slider element.

    // Making variables public (accessible via slider.vars)
    // Check if RTL (Right-to-Left) mode should be enabled by default if not specified and HTML dir is 'rtl'.
    if(typeof options.rtl=='undefined' && $('html').attr('dir')=='rtl'){
      options.rtl=true;
    }
    // Merge default options with user-provided options.
    slider.vars = $.extend({}, $.flexslider.defaults, options);

    // Internal variables, established from slider.vars.
    var namespace = slider.vars.namespace, // CSS class prefix.
        msGesture = window.navigator && window.navigator.msPointerEnabled && window.MSGesture, // Microsoft touch gesture support.
        touch = (( "ontouchstart" in window ) || msGesture || window.DocumentTouch && document instanceof DocumentTouch) && slider.vars.touch, // Touch event support detection.
        eventType = "click touchend MSPointerUp keyup", // Common event types for interactions.
        watchedEvent = "", // Used to manage event duplication.
        watchedEventClearTimer, // Timer for clearing watchedEvent.
        vertical = slider.vars.direction === "vertical", // Boolean: true if direction is vertical.
        reverse = slider.vars.reverse, // Boolean: true if animation should be reversed.
        carousel = (slider.vars.itemWidth > 0), // Boolean: true if the slider is a carousel (has itemWidth).
        fade = slider.vars.animation === "fade", // Boolean: true if animation type is "fade".
        asNav = slider.vars.asNavFor !== "", // Boolean: true if this slider acts as navigation for another.
        methods = {}; // Object to store private slider methods.

    // Store a reference to the slider object in the DOM element's data store.
    // This allows accessing the slider object later, e.g., $(element).data('flexslider').
    $.data(el, "flexslider", slider);

    // Private slider methods namespace.
    methods = {
      /**
       * Initializes the slider.
       * Sets up dimensions, event handlers, controls, and starts the slideshow if enabled.
       */
      init: function() {
        slider.animating = false; // Flag to track if an animation is currently in progress.
        // Get current slide and ensure it's a number; default to 0.
        slider.currentSlide = parseInt( ( slider.vars.startAt ? slider.vars.startAt : 0), 10 );
        if ( isNaN( slider.currentSlide ) ) { slider.currentSlide = 0; }
        slider.animatingTo = slider.currentSlide; // Target slide for animation.
        slider.atEnd = (slider.currentSlide === 0 || slider.currentSlide === slider.last); // True if at the first or last slide (relevant for non-looping sliders).
        slider.containerSelector = slider.vars.selector.substr(0,slider.vars.selector.search(' ')); // Selector for the slide container.
        slider.slides = $(slider.vars.selector, slider); // jQuery object for all slide elements.
        slider.container = $(slider.containerSelector, slider); // jQuery object for the slide container.
        slider.count = slider.slides.length; // Total number of slides.
        // SYNC: Check if a slider to sync with exists.
        slider.syncExists = $(slider.vars.sync).length > 0;
        // SLIDE: If animation is "slide", set easing to "swing" (jQuery default).
        if (slider.vars.animation === "slide") { slider.vars.animation = "swing"; }
        // Determine the CSS property to animate (top for vertical, marginLeft/marginRight for horizontal).
        slider.prop = (vertical) ? "top" : ( slider.vars.rtl ? "marginRight" : "marginLeft" );
        slider.args = {}; // Object to store animation arguments.
        // SLIDESHOW:
        slider.manualPause = false; // Flag for manual pause.
        slider.stopped = false; // Flag for slideshow being stopped completely.
        //PAUSE WHEN INVISIBLE
        slider.started = false; // Flag if slideshow has started.
        slider.startTimeout = null; // Timeout ID for slideshow start delay.
        // TOUCH/USECSS: Detect if CSS3 transitions are supported.
        slider.transitions = !slider.vars.video && !fade && slider.vars.useCSS && (function() {
          var obj = document.createElement('div'),
              props = ['perspectiveProperty', 'WebkitPerspective', 'MozPerspective', 'OPerspective', 'msPerspective'];
          for (var i in props) {
            if ( obj.style[ props[i] ] !== undefined ) {
              slider.pfx = props[i].replace('Perspective','').toLowerCase(); // CSS prefix (e.g., "webkit").
              slider.prop = "-" + slider.pfx + "-transform"; // CSS transform property.
              return true;
            }
          }
          return false;
        }());
        slider.isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1; // Check if browser is Firefox for specific CSS handling.
        slider.ensureAnimationEnd = ''; // Timeout for ensuring animation end event fires.
        // CONTROLSCONTAINER: If specified, set the container for navigation controls.
        if (slider.vars.controlsContainer !== "") slider.controlsContainer = $(slider.vars.controlsContainer).length > 0 && $(slider.vars.controlsContainer);
        // MANUAL: If specified, set up manual controls.
        if (slider.vars.manualControls !== "") slider.manualControls = $(slider.vars.manualControls).length > 0 && $(slider.vars.manualControls);

        // CUSTOM DIRECTION NAV: If specified, set up custom direction navigation elements.
        if (slider.vars.customDirectionNav !== "") slider.customDirectionNav = $(slider.vars.customDirectionNav).length === 2 && $(slider.vars.customDirectionNav);

        // RANDOMIZE: Randomize slide order if enabled.
        if (slider.vars.randomize) {
          slider.slides.sort(function() { return (Math.round(Math.random())-0.5); });
          slider.container.empty().append(slider.slides);
        }

        slider.doMath(); // Calculate dimensions and properties.

        // INIT: Perform initial setup (cloning slides for loop, etc.).
        slider.setup("init");

        // CONTROLNAV: Setup paging controls (dots/thumbnails) if enabled.
        if (slider.vars.controlNav) { methods.controlNav.setup(); }

        // DIRECTIONNAV: Setup previous/next arrow controls if enabled.
        if (slider.vars.directionNav) { methods.directionNav.setup(); }

        // KEYBOARD: Bind keyboard navigation (left/right arrows) if enabled.
        if (slider.vars.keyboard && ($(slider.containerSelector).length === 1 || slider.vars.multipleKeyboard)) {
          $(document).bind('keyup', function(event) {
            var keycode = event.keyCode;
            if (!slider.animating && (keycode === 39 || keycode === 37)) { // 39: right arrow, 37: left arrow
              var target = (slider.vars.rtl?
                                ((keycode === 37) ? slider.getTarget('next') :
                                (keycode === 39) ? slider.getTarget('prev') : false)
                                :
                                ((keycode === 39) ? slider.getTarget('next') :
                                (keycode === 37) ? slider.getTarget('prev') : false)
                                );
              slider.flexAnimate(target, slider.vars.pauseOnAction);
            }
          });
        }
        // MOUSEWHEEL: Bind mousewheel navigation if enabled.
        if (slider.vars.mousewheel) {
          slider.bind('mousewheel', function(event, delta, deltaX, deltaY) {
            event.preventDefault();
            var target = (delta < 0) ? slider.getTarget('next') : slider.getTarget('prev');
            slider.flexAnimate(target, slider.vars.pauseOnAction);
          });
        }

        // PAUSEPLAY: Setup pause/play button if enabled.
        if (slider.vars.pausePlay) { methods.pausePlay.setup(); }

        //PAUSE WHEN INVISIBLE: Initialize pauseWhenInvisible functionality.
        if (slider.vars.slideshow && slider.vars.pauseInvisible) { methods.pauseInvisible.init(); }

        // SLIDESHOW: Initialize slideshow functionality.
        if (slider.vars.slideshow) {
          // Pause slideshow on hover if enabled.
          if (slider.vars.pauseOnHover) {
            slider.hover(function() {
              if (!slider.manualPlay && !slider.manualPause) { slider.pause(); }
            }, function() {
              if (!slider.manualPause && !slider.manualPlay && !slider.stopped) { slider.play(); }
            });
          }
          // Initialize animation: Play if visible or if PageVisibility API is not used.
          if(!slider.vars.pauseInvisible || !methods.pauseInvisible.isHidden()) {
            (slider.vars.initDelay > 0) ? slider.startTimeout = setTimeout(slider.play, slider.vars.initDelay) : slider.play();
          }
        }

        // ASNAV: Setup if this slider acts as navigation for another.
        if (asNav) { methods.asNav.setup(); }

        // TOUCH: Initialize touch event handling if enabled.
        if (touch && slider.vars.touch) { methods.touch(); }

        // FADE && SMOOTHHEIGHT || SLIDE: Bind resize/orientationchange/focus events for recalculating dimensions.
        if (!fade || (fade && slider.vars.smoothHeight)) { $(window).bind("resize orientationchange focus", methods.resize); }

        // Make images non-draggable to prevent interference with swipe gestures.
        slider.find("img").attr("draggable", "false");

        // API: start() Callback - Fires after a brief delay to allow initialization to complete.
        setTimeout(function(){
          slider.vars.start(slider);
        }, 200);
      },
      /**
       * Methods for 'asNavFor' functionality (slider acting as navigation).
       */
      asNav: {
        setup: function() {
          slider.asNav = true;
          slider.animatingTo = Math.floor(slider.currentSlide/slider.move);
          slider.currentItem = slider.currentSlide;
          // Add active class to the current navigation item.
          slider.slides.removeClass(namespace + "active-slide").eq(slider.currentItem).addClass(namespace + "active-slide");
          if(!msGesture){ // Standard touch/click events for asNav items.
              slider.slides.on(eventType, function(e){
                e.preventDefault();
                var $slide = $(this),
                    target = $slide.index();
                var posFromX; // Calculate position for RTL/LTR.
                if(slider.vars.rtl){
                  posFromX = -1*($slide.offset().right - $(slider).scrollLeft());
                }
                else
                {
                  posFromX = $slide.offset().left - $(slider).scrollLeft();
                }
                // Logic to determine if interaction should trigger animation.
                if( posFromX <= 0 && $slide.hasClass( namespace + 'active-slide' ) ) {
                  slider.flexAnimate(slider.getTarget("prev"), true);
                } else if (!$(slider.vars.asNavFor).data('flexslider').animating && !$slide.hasClass(namespace + "active-slide")) {
                  slider.direction = (slider.currentItem < target) ? "next" : "prev";
                  slider.flexAnimate(target, slider.vars.pauseOnAction, false, true, true);
                }
              });
          }else{ // Microsoft Gesture events for asNav items.
              el._slider = slider;
              slider.slides.each(function (){
                  var that = this;
                  that._gesture = new MSGesture();
                  that._gesture.target = that;
                  that.addEventListener("MSPointerDown", function (e){
                      e.preventDefault();
                      if(e.currentTarget._gesture) {
                        e.currentTarget._gesture.addPointer(e.pointerId);
                      }
                  }, false);
                  that.addEventListener("MSGestureTap", function (e){
                      e.preventDefault();
                      var $slide = $(this),
                          target = $slide.index();
                      if (!$(slider.vars.asNavFor).data('flexslider').animating && !$slide.hasClass('active')) {
                          slider.direction = (slider.currentItem < target) ? "next" : "prev";
                          slider.flexAnimate(target, slider.vars.pauseOnAction, false, true, true);
                      }
                  });
              });
          }
        }
      },
      /**
       * Methods for control navigation (paging dots or thumbnails).
       */
      controlNav: {
        setup: function() {
          if (!slider.manualControls) { // Auto-generate paging controls.
            methods.controlNav.setupPaging();
          } else { // Use manually specified controls.
            methods.controlNav.setupManual();
          }
        },
        setupPaging: function() {
          var type = (slider.vars.controlNav === "thumbnails") ? 'control-thumbs' : 'control-paging', // Class for type of control nav.
              j = 1, // Counter for paging control text.
              item, // HTML for individual control item.
              slide; // Current slide element.

          // Create the ol element for control navigation.
          slider.controlNavScaffold = $('<ol class="'+ namespace + 'control-nav ' + namespace + type + '"></ol>');

          if (slider.pagingCount > 1) {
            for (var i = 0; i < slider.pagingCount; i++) {
              slide = slider.slides.eq(i);
              // Ensure data-thumb-alt attribute exists.
              if ( undefined === slide.attr( 'data-thumb-alt' ) ) { slide.attr( 'data-thumb-alt', '' ); }
              var altText = ( '' !== slide.attr( 'data-thumb-alt' ) ) ? altText = ' alt="' + slide.attr( 'data-thumb-alt' ) + '"' : '';
              // Create item: image for thumbnails, link with number for paging.
              item = (slider.vars.controlNav === "thumbnails") ? '<img src="' + slide.attr( 'data-thumb' ) + '"' + altText + '/>' : '<a href="#">' + j + '</a>';
              // Add caption to thumbnail if enabled.
              if ( 'thumbnails' === slider.vars.controlNav && true === slider.vars.thumbCaptions ) {
                var captn = slide.attr( 'data-thumbcaption' );
                if ( '' !== captn && undefined !== captn ) { item += '<span class="' + namespace + 'caption">' + captn + '</span>'; }
              }
              slider.controlNavScaffold.append('<li>' + item + '</li>');
              j++;
            }
          }

          // Append control nav to specified container or the slider itself.
          (slider.controlsContainer) ? $(slider.controlsContainer).append(slider.controlNavScaffold) : slider.append(slider.controlNavScaffold);
          methods.controlNav.set(); // Cache the control nav elements.
          methods.controlNav.active(); // Set the initial active control.

          // Event delegation for control nav clicks/touches.
          slider.controlNavScaffold.delegate('a, img', eventType, function(event) {
            event.preventDefault();

            if (watchedEvent === "" || watchedEvent === event.type) { // Prevent event duplication.
              var $this = $(this),
                  target = slider.controlNav.index($this);

              if (!$this.hasClass(namespace + 'active')) { // Animate if not already active.
                slider.direction = (target > slider.currentSlide) ? "next" : "prev";
                slider.flexAnimate(target, slider.vars.pauseOnAction);
              }
            }
            // Setup flags to prevent event duplication.
            if (watchedEvent === "") { watchedEvent = event.type; }
            methods.setToClearWatchedEvent();
          });
        },
        setupManual: function() { // Setup for manually provided control navigation.
          slider.controlNav = slider.manualControls;
          methods.controlNav.active(); // Set initial active state.
          // Event binding for manual controls.
          slider.controlNav.bind(eventType, function(event) {
            event.preventDefault();
            if (watchedEvent === "" || watchedEvent === event.type) {
              var $this = $(this),
                  target = slider.controlNav.index($this);
              if (!$this.hasClass(namespace + 'active')) {
                (target > slider.currentSlide) ? slider.direction = "next" : slider.direction = "prev";
                slider.flexAnimate(target, slider.vars.pauseOnAction);
              }
            }
            if (watchedEvent === "") { watchedEvent = event.type; }
            methods.setToClearWatchedEvent();
          });
        },
        set: function() { // Cache control nav elements.
          var selector = (slider.vars.controlNav === "thumbnails") ? 'img' : 'a';
          slider.controlNav = $('.' + namespace + 'control-nav li ' + selector, (slider.controlsContainer) ? slider.controlsContainer : slider);
        },
        active: function() { // Update active state of control nav.
          slider.controlNav.removeClass(namespace + "active").eq(slider.animatingTo).addClass(namespace + "active");
        },
        update: function(action, pos) { // Update control nav (e.g., when slides are added/removed).
          if (slider.pagingCount > 1 && action === "add") {
            slider.controlNavScaffold.append($('<li><a href="#">' + slider.count + '</a></li>'));
          } else if (slider.pagingCount === 1) { // Remove all if only one slide.
            slider.controlNavScaffold.find('li').remove();
          } else { // Remove specific item.
            slider.controlNav.eq(pos).closest('li').remove();
          }
          methods.controlNav.set();
          (slider.pagingCount > 1 && slider.pagingCount !== slider.controlNav.length) ? slider.update(pos, action) : methods.controlNav.active();
        }
      },
      /**
       * Methods for direction navigation (previous/next arrows).
       */
      directionNav: {
        setup: function() {
          // Create the HTML for direction navigation.
          var directionNavScaffold = $('<ul class="' + namespace + 'direction-nav"><li class="' + namespace + 'nav-prev"><a class="' + namespace + 'prev" href="#">' + slider.vars.prevText + '</a></li><li class="' + namespace + 'nav-next"><a class="' + namespace + 'next" href="#">' + slider.vars.nextText + '</a></li></ul>');

          // Use custom direction nav if provided.
          if (slider.customDirectionNav) {
            slider.directionNav = slider.customDirectionNav;
          // Append to controls container if specified.
          } else if (slider.controlsContainer) {
            $(slider.controlsContainer).append(directionNavScaffold);
            slider.directionNav = $('.' + namespace + 'direction-nav li a', slider.controlsContainer);
          } else { // Append to the slider element itself.
            slider.append(directionNavScaffold);
            slider.directionNav = $('.' + namespace + 'direction-nav li a', slider);
          }

          methods.directionNav.update(); // Set initial state (disabled if at ends and not looping).

          // Event binding for direction nav clicks/touches.
          slider.directionNav.bind(eventType, function(event) {
            event.preventDefault();
            var target;
            if (watchedEvent === "" || watchedEvent === event.type) {
              target = ($(this).hasClass(namespace + 'next')) ? slider.getTarget('next') : slider.getTarget('prev');
              slider.flexAnimate(target, slider.vars.pauseOnAction);
            }
            if (watchedEvent === "") { watchedEvent = event.type; }
            methods.setToClearWatchedEvent();
          });
        },
        update: function() { // Update disabled states of direction nav.
          var disabledClass = namespace + 'disabled';
          if (slider.pagingCount === 1) { // Disable both if only one slide.
            slider.directionNav.addClass(disabledClass).attr('tabindex', '-1');
          } else if (!slider.vars.animationLoop) { // Handle non-looping sliders.
            if (slider.animatingTo === 0) { // At first slide.
              slider.directionNav.removeClass(disabledClass).filter('.' + namespace + "prev").addClass(disabledClass).attr('tabindex', '-1');
            } else if (slider.animatingTo === slider.last) { // At last slide.
              slider.directionNav.removeClass(disabledClass).filter('.' + namespace + "next").addClass(disabledClass).attr('tabindex', '-1');
            } else { // In middle, both enabled.
              slider.directionNav.removeClass(disabledClass).removeAttr('tabindex');
            }
          } else { // Looping slider, both always enabled.
            slider.directionNav.removeClass(disabledClass).removeAttr('tabindex');
          }
        }
      },
      /**
       * Methods for pause/play button functionality.
       */
      pausePlay: {
        setup: function() {
          // Create HTML for pause/play button.
          var pausePlayScaffold = $('<div class="' + namespace + 'pauseplay"><a href="#"></a></div>');

          // Append to controls container or slider element.
          if (slider.controlsContainer) {
            slider.controlsContainer.append(pausePlayScaffold);
            slider.pausePlay = $('.' + namespace + 'pauseplay a', slider.controlsContainer);
          } else {
            slider.append(pausePlayScaffold);
            slider.pausePlay = $('.' + namespace + 'pauseplay a', slider);
          }

          // Set initial state (pause or play icon/text).
          methods.pausePlay.update((slider.vars.slideshow) ? namespace + 'pause' : namespace + 'play');

          // Event binding for pause/play button.
          slider.pausePlay.bind(eventType, function(event) {
            event.preventDefault();
            if (watchedEvent === "" || watchedEvent === event.type) {
              if ($(this).hasClass(namespace + 'pause')) { // If "pause" is clicked.
                slider.manualPause = true; slider.manualPlay = false; slider.pause();
              } else { // If "play" is clicked.
                slider.manualPause = false; slider.manualPlay = true; slider.play();
              }
            }
            if (watchedEvent === "") { watchedEvent = event.type; }
            methods.setToClearWatchedEvent();
          });
        },
        update: function(state) { // Update icon/text of pause/play button.
          (state === "play") ? slider.pausePlay.removeClass(namespace + 'pause').addClass(namespace + 'play').html(slider.vars.playText) : slider.pausePlay.removeClass(namespace + 'play').addClass(namespace + 'pause').html(slider.vars.pauseText);
        }
      },
      /**
       * Touch event handling for swipe navigation.
       * This is a complex section dealing with touchstart, touchmove, touchend,
       * and Microsoft gesture events (MSPointerDown, MSGestureChange, MSGestureEnd).
       * It calculates swipe distances and directions to animate the slider.
       */
      touch: function() {
        var startX, startY, offset, cwidth, dx, startT,
            onTouchStart, onTouchMove, onTouchEnd,
            scrolling = false, localX = 0, localY = 0, accDx = 0;

        if(!msGesture){ // Standard touch events.
            onTouchStart = function(e) {
              if (slider.animating) { e.preventDefault(); } // Prevent if already animating.
              else if ( ( window.navigator.msPointerEnabled ) || e.touches.length === 1 ) { // Single touch.
                slider.pause();
                cwidth = (vertical) ? slider.h : slider.w; // Slider width/height.
                startT = Number(new Date()); // Touch start time.
                localX = e.touches[0].pageX; // Initial X position.
                localY = e.touches[0].pageY; // Initial Y position.
                // Calculate initial offset for slide position.
                offset = (carousel && reverse && slider.animatingTo === slider.last) ? 0 :
                         (carousel && reverse) ? slider.limit - (((slider.itemW + slider.vars.itemMargin) * slider.move) * slider.animatingTo) :
                         (carousel && slider.currentSlide === slider.last) ? slider.limit :
                         (carousel) ? ((slider.itemW + slider.vars.itemMargin) * slider.move) * slider.currentSlide :
                         (reverse) ? (slider.last - slider.currentSlide + slider.cloneOffset) * cwidth : (slider.currentSlide + slider.cloneOffset) * cwidth;
                startX = (vertical) ? localY : localX;
                startY = (vertical) ? localX : localY;
                el.addEventListener('touchmove', onTouchMove, false);
                el.addEventListener('touchend', onTouchEnd, false);
              }
            };

            onTouchMove = function(e) {
              localX = e.touches[0].pageX;
              localY = e.touches[0].pageY;
              dx = (vertical) ? startX - localY : (slider.vars.rtl?-1:1)*(startX - localX); // Calculate swipe distance.
              // Determine if scrolling vertically or horizontally.
              scrolling = (vertical) ? (Math.abs(dx) < Math.abs(localX - startY)) : (Math.abs(dx) < Math.abs(localY - startY));
              var fxms = 500; // Threshold for swipe time.

              if ( ! scrolling || Number( new Date() ) - startT > fxms ) { // If not scrolling or swipe is long enough.
                e.preventDefault();
                if (!fade && slider.transitions) { // If using CSS transitions.
                  if (!slider.vars.animationLoop) { // Adjust dx for non-looping sliders at ends.
                    dx = dx/((slider.currentSlide === 0 && dx < 0 || slider.currentSlide === slider.last && dx > 0) ? (Math.abs(dx)/cwidth+2) : 1);
                  }
                  slider.setProps(offset + dx, "setTouch"); // Update slide position during swipe.
                }
              }
            };

            onTouchEnd = function(e) {
              el.removeEventListener('touchmove', onTouchMove, false);
              if (slider.animatingTo === slider.currentSlide && !scrolling && !(dx === null)) {
                var updateDx = (reverse) ? -dx : dx,
                    target = (updateDx > 0) ? slider.getTarget('next') : slider.getTarget('prev');
                // Animate to target if swipe meets threshold.
                if (slider.canAdvance(target) && (Number(new Date()) - startT < 550 && Math.abs(updateDx) > 50 || Math.abs(updateDx) > cwidth/2)) {
                  slider.flexAnimate(target, slider.vars.pauseOnAction);
                } else { // Snap back if swipe doesn't meet threshold.
                  if (!fade) { slider.flexAnimate(slider.currentSlide, slider.vars.pauseOnAction, true); }
                }
              }
              el.removeEventListener('touchend', onTouchEnd, false);
              // Reset touch variables.
              startX = null; startY = null; dx = null; offset = null;
            };
            el.addEventListener('touchstart', onTouchStart, false);
        } else { // Microsoft gesture events.
            el.style.msTouchAction = "none"; // Disable default touch actions.
            el._gesture = new MSGesture();
            el._gesture.target = el;
            el.addEventListener("MSPointerDown", onMSPointerDown, false);
            el._slider = slider; // Store reference for gesture events.
            el.addEventListener("MSGestureChange", onMSGestureChange, false);
            el.addEventListener("MSGestureEnd", onMSGestureEnd, false);

            function onMSPointerDown(e){ /* Similar logic to onTouchStart for MS pointers */
                e.stopPropagation();
                if (slider.animating) { e.preventDefault(); }
                else{
                    slider.pause();
                    el._gesture.addPointer(e.pointerId);
                    accDx = 0;
                    cwidth = (vertical) ? slider.h : slider.w;
                    startT = Number(new Date());
                    offset = (carousel && reverse && slider.animatingTo === slider.last) ? 0 :
                        (carousel && reverse) ? slider.limit - (((slider.itemW + slider.vars.itemMargin) * slider.move) * slider.animatingTo) :
                            (carousel && slider.currentSlide === slider.last) ? slider.limit :
                                (carousel) ? ((slider.itemW + slider.vars.itemMargin) * slider.move) * slider.currentSlide :
                                    (reverse) ? (slider.last - slider.currentSlide + slider.cloneOffset) * cwidth : (slider.currentSlide + slider.cloneOffset) * cwidth;
                }
            }
            function onMSGestureChange(e) { /* Similar logic to onTouchMove for MS gestures */
                e.stopPropagation();
                var slider = e.target._slider; if(!slider){ return; }
                var transX = -e.translationX, transY = -e.translationY;
                accDx = accDx + ((vertical) ? transY : transX);
                dx = (slider.vars.rtl?-1:1)*accDx;
                scrolling = (vertical) ? (Math.abs(accDx) < Math.abs(-transX)) : (Math.abs(accDx) < Math.abs(-transY));
                if(e.detail === e.MSGESTURE_FLAG_INERTIA){ setImmediate(function (){ el._gesture.stop(); }); return; }
                if (!scrolling || Number(new Date()) - startT > 500) {
                    e.preventDefault();
                    if (!fade && slider.transitions) {
                        if (!slider.vars.animationLoop) {
                            dx = accDx / ((slider.currentSlide === 0 && accDx < 0 || slider.currentSlide === slider.last && accDx > 0) ? (Math.abs(accDx) / cwidth + 2) : 1);
                        }
                        slider.setProps(offset + dx, "setTouch");
                    }
                }
            }
            function onMSGestureEnd(e) { /* Similar logic to onTouchEnd for MS gestures */
                e.stopPropagation();
                var slider = e.target._slider; if(!slider){ return; }
                if (slider.animatingTo === slider.currentSlide && !scrolling && !(dx === null)) {
                    var updateDx = (reverse) ? -dx : dx,
                        target = (updateDx > 0) ? slider.getTarget('next') : slider.getTarget('prev');
                    if (slider.canAdvance(target) && (Number(new Date()) - startT < 550 && Math.abs(updateDx) > 50 || Math.abs(updateDx) > cwidth/2)) {
                        slider.flexAnimate(target, slider.vars.pauseOnAction);
                    } else {
                        if (!fade) { slider.flexAnimate(slider.currentSlide, slider.vars.pauseOnAction, true); }
                    }
                }
                startX = null; startY = null; dx = null; offset = null; accDx = 0;
            }
        }
      },
      /**
       * Handles window resize events to recalculate dimensions and adjust the slider.
       */
      resize: function() {
        if (!slider.animating && slider.is(':visible')) {
          if (!carousel) { slider.doMath(); } // Recalculate for non-carousel sliders.
          if (fade) { methods.smoothHeight(); } // Adjust height for fade animations.
          else if (carousel) { // Adjustments for carousel sliders.
            slider.slides.width(slider.computedW);
            slider.update(slider.pagingCount);
            slider.setProps();
          }
          else if (vertical) { // Adjustments for vertical sliders.
            slider.viewport.height(slider.h);
            slider.setProps(slider.h, "setTotal");
          } else { // Horizontal slide adjustments.
            if (slider.vars.smoothHeight) { methods.smoothHeight(); }
            slider.newSlides.width(slider.computedW);
            slider.setProps(slider.computedW, "setTotal");
          }
        }
      },
      /**
       * Animates the slider height smoothly if smoothHeight option is enabled.
       * @param {number} [dur] - Animation duration.
       */
      smoothHeight: function(dur) {
        if (!vertical || fade) {
          var $obj = (fade) ? slider : slider.viewport;
          (dur) ? $obj.animate({"height": slider.slides.eq(slider.animatingTo).innerHeight()}, dur) : $obj.innerHeight(slider.slides.eq(slider.animatingTo).innerHeight());
        }
      },
      /**
       * Synchronizes this slider's actions with another FlexSlider instance.
       * @param {string} action - The action to sync ("animate", "play", "pause").
       */
      sync: function(action) {
        var $obj = $(slider.vars.sync).data("flexslider"), // The slider to sync with.
            target = slider.animatingTo;
        switch (action) {
          case "animate": $obj.flexAnimate(target, slider.vars.pauseOnAction, false, true); break;
          case "play": if (!$obj.playing && !$obj.asNav) { $obj.play(); } break;
          case "pause": $obj.pause(); break;
        }
      },
      /**
       * Utility function to ensure unique IDs for cloned slides by appending '_clone'.
       * @param {jQuery} $clone - The cloned slide element.
       * @return {jQuery} The cloned slide with updated IDs.
       */
      uniqueID: function($clone) {
        $clone.filter( '[id]' ).add($clone.find( '[id]' )).each(function() {
          var $this = $(this);
          $this.attr( 'id', $this.attr( 'id' ) + '_clone' );
        });
        return $clone;
      },
      /**
       * Methods for pausing the slideshow when the page/tab is not visible (Page Visibility API).
       */
      pauseInvisible: {
        visProp: null, // Stores the browser-specific hidden property name.
        init: function() { // Initialize event listener for visibility change.
          var visProp = methods.pauseInvisible.getHiddenProp();
          if (visProp) {
            var evtname = visProp.replace(/[H|h]idden/,'') + 'visibilitychange';
            document.addEventListener(evtname, function() {
              if (methods.pauseInvisible.isHidden()) { // If page becomes hidden.
                if(slider.startTimeout) { clearTimeout(slider.startTimeout); }
                else { slider.pause(); }
              }
              else { // If page becomes visible.
                if(slider.started) { slider.play(); }
                else { (slider.vars.initDelay > 0) ? setTimeout(slider.play, slider.vars.initDelay) : slider.play(); }
              }
            });
          }
        },
        isHidden: function() { // Checks if the page is currently hidden.
          var prop = methods.pauseInvisible.getHiddenProp();
          if (!prop) { return false; }
          return document[prop];
        },
        getHiddenProp: function() { // Gets the browser-prefixed hidden property name.
          var prefixes = ['webkit','moz','ms','o'];
          if ('hidden' in document) return 'hidden'; // Standard property.
          for ( var i = 0; i < prefixes.length; i++ ) { // Prefixed properties.
              if ((prefixes[i] + 'Hidden') in document) return prefixes[i] + 'Hidden';
          }
          return null; // Not supported.
        }
      },
      /**
       * Helper function to prevent event duplication by clearing a timer for watched events.
       */
      setToClearWatchedEvent: function() {
        clearTimeout(watchedEventClearTimer);
        watchedEventClearTimer = setTimeout(function() {
          watchedEvent = ""; // Reset watched event after a delay.
        }, 3000);
      }
    }; // End methods object

    // === Public Methods ===

    /**
     * Main animation function. Animates the slider to the target slide.
     * @param {number} target - Index of the target slide.
     * @param {boolean} [pause] - Whether to pause slideshow on this action.
     * @param {boolean} [override] - Force animation even if conditions normally prevent it.
     * @param {boolean} [withSync] - Internal flag for sync operations.
     * @param {boolean} [fromNav] - Internal flag if called from asNav.
     */
    slider.flexAnimate = function(target, pause, override, withSync, fromNav) {
      // Determine animation direction if not looping.
      if (!slider.vars.animationLoop && target !== slider.currentSlide) {
        slider.direction = (target > slider.currentSlide) ? "next" : "prev";
      }
      // Handle direction for asNav sliders.
      if (asNav && slider.pagingCount === 1) slider.direction = (slider.currentItem < target) ? "next" : "prev";

      // Check if animation is allowed and slider is visible.
      if (!slider.animating && (slider.canAdvance(target, fromNav) || override) && slider.is(":visible")) {
        // Handle asNav synchronization.
        if (asNav && withSync) {
          var master = $(slider.vars.asNavFor).data('flexslider');
          slider.atEnd = target === 0 || target === slider.count - 1;
          master.flexAnimate(target, true, false, true, fromNav);
          slider.direction = (slider.currentItem < target) ? "next" : "prev";
          master.direction = slider.direction;

          if (Math.ceil((target + 1)/slider.visible) - 1 !== slider.currentSlide && target !== 0) {
            slider.currentItem = target;
            slider.slides.removeClass(namespace + "active-slide").eq(target).addClass(namespace + "active-slide");
            target = Math.floor(target/slider.visible);
          } else {
            slider.currentItem = target;
            slider.slides.removeClass(namespace + "active-slide").eq(target).addClass(namespace + "active-slide");
            return false; // Prevent further animation if target is already correct for asNav.
          }
        }

        slider.animating = true; // Set animating flag.
        slider.animatingTo = target; // Store target slide index.

        if (pause) { slider.pause(); } // Pause slideshow if requested.
        slider.vars.before(slider); // API: before() callback.
        if (slider.syncExists && !fromNav) { methods.sync("animate"); } // Sync with other sliders.
        if (slider.vars.controlNav) { methods.controlNav.active(); } // Update control navigation.

        // Add active class to target slide for non-carousel sliders.
        if (!carousel) { slider.slides.removeClass(namespace + 'active-slide').eq(target).addClass(namespace + 'active-slide'); }

        slider.atEnd = target === 0 || target === slider.last; // Update atEnd flag.
        if (slider.vars.directionNav) { methods.directionNav.update(); } // Update direction navigation.

        if (target === slider.last) { // If target is the last slide.
          slider.vars.end(slider); // API: end() callback.
          if (!slider.vars.animationLoop) { slider.pause(); } // Pause if not looping.
        }

        // Perform animation (slide or fade).
        if (!fade) { // Slide animation.
          var dimension = (vertical) ? slider.slides.filter(':first').height() : slider.computedW,
              margin, slideString, calcNext;

          if (carousel) { // Carousel slide calculation.
            margin = slider.vars.itemMargin;
            calcNext = ((slider.itemW + margin) * slider.move) * slider.animatingTo;
            slideString = (calcNext > slider.limit && slider.visible !== 1) ? slider.limit : calcNext;
          } else if (slider.currentSlide === 0 && target === slider.count - 1 && slider.vars.animationLoop && slider.direction !== "next") { // Loop to end from start.
            slideString = (reverse) ? (slider.count + slider.cloneOffset) * dimension : 0;
          } else if (slider.currentSlide === slider.last && target === 0 && slider.vars.animationLoop && slider.direction !== "prev") { // Loop to start from end.
            slideString = (reverse) ? 0 : (slider.count + 1) * dimension;
          } else { // Standard slide.
            slideString = (reverse) ? ((slider.count - 1) - target + slider.cloneOffset) * dimension : (target + slider.cloneOffset) * dimension;
          }
          slider.setProps(slideString, "", slider.vars.animationSpeed); // Set CSS properties for animation.

          if (slider.transitions) { // If using CSS transitions.
            if (!slider.vars.animationLoop || !slider.atEnd) {
              slider.animating = false;
              slider.currentSlide = slider.animatingTo;
            }
            // Bind transitionend event to call wrapup.
            slider.container.unbind("webkitTransitionEnd transitionend");
            slider.container.bind("webkitTransitionEnd transitionend", function() {
              clearTimeout(slider.ensureAnimationEnd); slider.wrapup(dimension);
            });
            // Fallback timer for transitionEnd.
            clearTimeout(slider.ensureAnimationEnd);
            slider.ensureAnimationEnd = setTimeout(function() {
              slider.wrapup(dimension);
            }, slider.vars.animationSpeed + 100);
          } else { // If using jQuery animate.
            slider.container.animate(slider.args, slider.vars.animationSpeed, slider.vars.easing, function(){
              slider.wrapup(dimension);
            });
          }
        } else { // Fade animation.
          if (!touch) { // Standard fade.
            slider.slides.eq(slider.currentSlide).css({"zIndex": 1}).animate({"opacity": 0}, slider.vars.animationSpeed, slider.vars.easing);
            slider.slides.eq(target).css({"zIndex": 2}).animate({"opacity": 1}, slider.vars.animationSpeed, slider.vars.easing, slider.wrapup);
          } else { // Fade with touch (opacity and z-index).
            slider.slides.eq(slider.currentSlide).css({ "opacity": 0, "zIndex": 1 });
            slider.slides.eq(target).css({ "opacity": 1, "zIndex": 2 });
            slider.wrapup(dimension); // Pass undefined dimension for fade.
          }
        }
        // Adjust height smoothly if enabled.
        if (slider.vars.smoothHeight) { methods.smoothHeight(slider.vars.animationSpeed); }
      }
    };

    /**
     * Post-animation cleanup and finalization.
     * @param {number} [dimension] - Dimension used for slide calculations (not always used for fade).
     */
    slider.wrapup = function(dimension) {
      // Handle looping for slide animations (jump to clones).
      if (!fade && !carousel) {
        if (slider.currentSlide === 0 && slider.animatingTo === slider.last && slider.vars.animationLoop) {
          slider.setProps(dimension, "jumpEnd");
        } else if (slider.currentSlide === slider.last && slider.animatingTo === 0 && slider.vars.animationLoop) {
          slider.setProps(dimension, "jumpStart");
        }
      }
      slider.animating = false; // Reset animating flag.
      slider.currentSlide = slider.animatingTo; // Update current slide index.
      slider.vars.after(slider); // API: after() callback.
    };

    // SLIDESHOW: Animate to the next slide in the slideshow.
    slider.animateSlides = function() {
      if (!slider.animating && focused ) { slider.flexAnimate(slider.getTarget("next")); }
    };
    // SLIDESHOW: Pause the slideshow.
    slider.pause = function() {
      clearInterval(slider.animatedSlides); // Clear slideshow interval.
      slider.animatedSlides = null;
      slider.playing = false;
      if (slider.vars.pausePlay) { methods.pausePlay.update("play"); } // Update pause/play button.
      if (slider.syncExists) { methods.sync("pause"); } // Sync pause action.
    };
    // SLIDESHOW: Start or resume the slideshow.
    slider.play = function() {
      if (slider.playing) { clearInterval(slider.animatedSlides); } // Clear existing interval if any.
      // Set new interval for slideshow.
      slider.animatedSlides = slider.animatedSlides || setInterval(slider.animateSlides, slider.vars.slideshowSpeed);
      slider.started = slider.playing = true;
      if (slider.vars.pausePlay) { methods.pausePlay.update("pause"); } // Update pause/play button.
      if (slider.syncExists) { methods.sync("play"); } // Sync play action.
    };
    // STOP: Completely stop the slideshow (cannot be resumed with play).
    slider.stop = function () {
      slider.pause();
      slider.stopped = true;
    };
    /**
     * Determines if the slider can advance to the target slide.
     * @param {number} target - Index of the target slide.
     * @param {boolean} [fromNav] - Internal flag if called from asNav.
     * @return {boolean} True if slider can advance, false otherwise.
     */
    slider.canAdvance = function(target, fromNav) {
      var last = (asNav) ? slider.pagingCount - 1 : slider.last;
      return (fromNav) ? true : // Always allow if fromNav (internal call).
             // Specific conditions for asNav looping.
             (asNav && slider.currentItem === slider.count - 1 && target === 0 && slider.direction === "prev") ? true :
             (asNav && slider.currentItem === 0 && target === slider.pagingCount - 1 && slider.direction !== "next") ? false :
             (target === slider.currentSlide && !asNav) ? false : // Cannot advance to current slide.
             (slider.vars.animationLoop) ? true : // Always allow if looping.
             // Conditions for non-looping sliders at ends.
             (slider.atEnd && slider.currentSlide === 0 && target === last && slider.direction !== "next") ? false :
             (slider.atEnd && slider.currentSlide === last && target === 0 && slider.direction === "next") ? false :
             true;
    };
    /**
     * Gets the target slide index based on direction ("next" or "prev").
     * @param {string} dir - Direction ("next" or "prev").
     * @return {number} Index of the target slide.
     */
    slider.getTarget = function(dir) {
      slider.direction = dir;
      if (dir === "next") {
        return (slider.currentSlide === slider.last) ? 0 : slider.currentSlide + 1;
      } else {
        return (slider.currentSlide === 0) ? slider.last : slider.currentSlide - 1;
      }
    };

    // SLIDE: Sets CSS properties for slide animation (positioning).
    // @param {number} pos - Position value.
    // @param {string} [special] - Special type of set (e.g., "setTouch", "jumpEnd").
    // @param {number} [dur] - Duration for CSS transition.
    slider.setProps = function(pos, special, dur) {
      var target = (function() { // Calculate target position string.
        var posCheck = (pos) ? pos : ((slider.itemW + slider.vars.itemMargin) * slider.move) * slider.animatingTo,
            posCalc = (function() {
              if (carousel) {
                return (special === "setTouch") ? pos :
                       (reverse && slider.animatingTo === slider.last) ? 0 :
                       (reverse) ? slider.limit - (((slider.itemW + slider.vars.itemMargin) * slider.move) * slider.animatingTo) :
                       (slider.animatingTo === slider.last) ? slider.limit : posCheck;
              } else {
                switch (special) {
                  case "setTotal": return (reverse) ? ((slider.count - 1) - slider.currentSlide + slider.cloneOffset) * pos : (slider.currentSlide + slider.cloneOffset) * pos;
                  case "setTouch": return (reverse) ? pos : pos;
                  case "jumpEnd": return (reverse) ? pos : slider.count * pos;
                  case "jumpStart": return (reverse) ? slider.count * pos : pos;
                  default: return pos;
                }
              }
            }());
            return (posCalc * ((slider.vars.rtl)?1:-1)) + "px"; // Apply RTL adjustment.
          }());

      if (slider.transitions) { // If using CSS transitions.
        // Apply translate3d for hardware acceleration. Firefox needs specific handling for RTL.
        if (slider.isFirefox) {
          target = (vertical) ? "translate3d(0," + target + ",0)" : "translate3d(" + (parseInt(target)+'px') + ",0,0)";
        } else {
          target = (vertical) ? "translate3d(0," + target + ",0)" : "translate3d(" + ((slider.vars.rtl?-1:1)*parseInt(target)+'px') + ",0,0)";
        }
        dur = (dur !== undefined) ? (dur/1000) + "s" : "0s"; // Convert duration to seconds string.
        slider.container.css("-" + slider.pfx + "-transition-duration", dur); // Set vendor-prefixed transition duration.
        slider.container.css("transition-duration", dur); // Set standard transition duration.
      }

      slider.args[slider.prop] = target; // Store target property for jQuery animate or direct CSS.
      // Apply CSS: directly if transitions or no duration, otherwise jQuery animate handles it in flexAnimate.
      if (slider.transitions || dur === undefined) { slider.container.css(slider.args); }
      slider.container.css('transform',target); // Ensure transform is applied (especially for transitions).
    };

    /**
     * Sets up the slider structure (viewport, clones for looping).
     * @param {string} type - Type of setup ("init" or other).
     */
    slider.setup = function(type) {
      if (!fade) { // Setup for "slide" animation.
        var sliderOffset, arr;
        if (type === "init") {
          // Create viewport element for slide animation.
          slider.viewport = $('<div class="' + namespace + 'viewport"></div>').css({"overflow": "hidden", "position": "relative"}).appendTo(slider).append(slider.container);
          slider.cloneCount = 0;
          slider.cloneOffset = 0;
          if (reverse) { // Reverse slide order if enabled.
            arr = $.makeArray(slider.slides).reverse();
            slider.slides = $(arr);
            slider.container.empty().append(slider.slides);
          }
        }
        // Clone slides for infinite loop if not a carousel.
        if (slider.vars.animationLoop && !carousel) {
          slider.cloneCount = 2;
          slider.cloneOffset = 1;
          if (type !== "init") { slider.container.find('.clone').remove(); } // Clear old clones.
          // Add clones to beginning and end.
          slider.container.append(methods.uniqueID(slider.slides.first().clone().addClass('clone')).attr('aria-hidden', 'true'))
                          .prepend(methods.uniqueID(slider.slides.last().clone().addClass('clone')).attr('aria-hidden', 'true'));
        }
        slider.newSlides = $(slider.vars.selector, slider); // Update slides collection.
        // Calculate initial offset.
        sliderOffset = (reverse) ? slider.count - 1 - slider.currentSlide + slider.cloneOffset : slider.currentSlide + slider.cloneOffset;
        if (vertical && !carousel) { // Vertical slide setup.
          slider.container.height((slider.count + slider.cloneCount) * 200 + "%").css("position", "absolute").width("100%");
          setTimeout(function(){ // Delay for browser rendering.
            slider.newSlides.css({"display": "block"});
            slider.doMath(); // Recalculate dimensions.
            slider.viewport.height(slider.h);
            slider.setProps(sliderOffset * slider.h, "init");
          }, (type === "init") ? 100 : 0);
        } else { // Horizontal slide setup.
          slider.container.width((slider.count + slider.cloneCount) * 200 + "%");
          slider.setProps(sliderOffset * slider.computedW, "init");
          setTimeout(function(){ // Delay for browser rendering.
            slider.doMath();
            // Apply RTL specific float if needed. Firefox has different float behavior with RTL.
            if(slider.vars.rtl){
              if (slider.isFirefox) {
                slider.newSlides.css({"width": slider.computedW, "marginRight" : slider.computedM, "float": "right", "display": "block"});
              } else {
                slider.newSlides.css({"width": slider.computedW, "marginRight" : slider.computedM, "float": "left", "display": "block"});
              }
            } else {
              slider.newSlides.css({"width": slider.computedW, "marginRight" : slider.computedM, "float": "left", "display": "block"});
            }
            if (slider.vars.smoothHeight) { methods.smoothHeight(); }
          }, (type === "init") ? 100 : 0);
        }
      } else { // Setup for "fade" animation.
        // Apply RTL specific float for fade.
        if(slider.vars.rtl){
          slider.slides.css({"width": "100%", "float": 'right', "marginLeft": "-100%", "position": "relative"});
        } else {
          slider.slides.css({"width": "100%", "float": 'left', "marginRight": "-100%", "position": "relative"});
        }
        if (type === "init") {
          if (!touch) { // Initial fade-in logic.
            if (slider.vars.fadeFirstSlide == false) { // Show first slide immediately if fadeFirstSlide is false.
              slider.slides.css({ "opacity": 0, "display": "block", "zIndex": 1 }).eq(slider.currentSlide).css({"zIndex": 2}).css({"opacity": 1});
            } else { // Fade in first slide.
              slider.slides.css({ "opacity": 0, "display": "block", "zIndex": 1 }).eq(slider.currentSlide).css({"zIndex": 2}).animate({"opacity": 1},slider.vars.animationSpeed,slider.vars.easing);
            }
          } else { // Fade with touch (uses CSS opacity transition).
            slider.slides.css({ "opacity": 0, "display": "block", "webkitTransition": "opacity " + slider.vars.animationSpeed / 1000 + "s ease", "zIndex": 1 }).eq(slider.currentSlide).css({ "opacity": 1, "zIndex": 2});
          }
        }
        if (slider.vars.smoothHeight) { methods.smoothHeight(); } // Adjust height.
      }
      // Add active class to current slide for non-carousel sliders.
      if (!carousel) { slider.slides.removeClass(namespace + "active-slide").eq(slider.currentSlide).addClass(namespace + "active-slide"); }
      slider.vars.init(slider); // API: init() callback.
    };

    /**
     * Calculates various dimensions and properties of the slider and its items.
     * Critical for responsive behavior and carousel calculations.
     */
    slider.doMath = function() {
      var slide = slider.slides.first(), // First slide for dimension calculations.
          slideMargin = slider.vars.itemMargin,
          minItems = slider.vars.minItems,
          maxItems = slider.vars.maxItems;

      slider.w = (slider.viewport===undefined) ? slider.width() : slider.viewport.width(); // Slider width.
      if (slider.isFirefox) { slider.w = slider.width(); } // Firefox width fix.
      slider.h = slide.height(); // Slide height.
      slider.boxPadding = slide.outerWidth() - slide.width(); // Padding/border of slides.

      if (carousel) { // Calculations specific to carousel mode.
        slider.itemT = slider.vars.itemWidth + slideMargin; // Total width of one item including margin.
        slider.itemM = slideMargin;
        // Determine min/max width for carousel items based on options and slider width.
        slider.minW = (minItems) ? minItems * slider.itemT : slider.w;
        slider.maxW = (maxItems) ? (maxItems * slider.itemT) - slideMargin : slider.w;
        // Calculate actual item width based on constraints.
        slider.itemW = (slider.minW > slider.w) ? (slider.w - (slideMargin * (minItems - 1)))/minItems :
                       (slider.maxW < slider.w) ? (slider.w - (slideMargin * (maxItems - 1)))/maxItems :
                       (slider.vars.itemWidth > slider.w) ? slider.w : slider.vars.itemWidth;

        slider.visible = Math.floor(slider.w/(slider.itemW)); // Number of visible items.
        slider.move = (slider.vars.move > 0 && slider.vars.move < slider.visible ) ? slider.vars.move : slider.visible; // Number of items to move per animation.
        slider.pagingCount = Math.ceil(((slider.count - slider.visible)/slider.move) + 1); // Total number of pages.
        slider.last =  slider.pagingCount - 1; // Index of the last page.
        // Calculate limit for carousel scrolling.
        slider.limit = (slider.pagingCount === 1) ? 0 :
                       (slider.vars.itemWidth > slider.w) ? (slider.itemW * (slider.count - 1)) + (slideMargin * (slider.count - 1)) : ((slider.itemW + slideMargin) * slider.count) - slider.w - slideMargin;
      } else { // Non-carousel calculations.
        slider.itemW = slider.w;
        slider.itemM = slideMargin;
        slider.pagingCount = slider.count;
        slider.last = slider.count - 1;
      }
      // Computed width and margin for slides (itemW - boxPadding).
      slider.computedW = slider.itemW - slider.boxPadding;
      slider.computedM = slider.itemM;
    };

    /**
     * Updates slider properties when slides are added or removed.
     * @param {number} pos - Position related to the update.
     * @param {string} action - "add" or "remove".
     */
    slider.update = function(pos, action) {
      slider.doMath(); // Recalculate dimensions.

      // Update currentSlide and animatingTo if necessary (for non-carousel).
      if (!carousel) {
        if (pos < slider.currentSlide) { slider.currentSlide += 1; }
        else if (pos <= slider.currentSlide && pos !== 0) { slider.currentSlide -= 1; }
        slider.animatingTo = slider.currentSlide;
      }

      // Update control navigation.
      if (slider.vars.controlNav && !slider.manualControls) {
        if ((action === "add" && !carousel) || slider.pagingCount > slider.controlNav.length) {
          methods.controlNav.update("add");
        } else if ((action === "remove" && !carousel) || slider.pagingCount < slider.controlNav.length) {
          if (carousel && slider.currentSlide > slider.last) {
            slider.currentSlide -= 1; slider.animatingTo -= 1;
          }
          methods.controlNav.update("remove", slider.last);
        }
      }
      // Update direction navigation.
      if (slider.vars.directionNav) { methods.directionNav.update(); }
    };

    /**
     * Adds a new slide to the slider.
     * @param {jQuery|HTMLElement} obj - The slide element to add.
     * @param {number} [pos] - Position to add the slide at.
     */
    slider.addSlide = function(obj, pos) {
      var $obj = $(obj);
      slider.count += 1;
      slider.last = slider.count - 1;
      // Append new slide based on direction and position.
      if (vertical && reverse) {
        (pos !== undefined) ? slider.slides.eq(slider.count - pos).after($obj) : slider.container.prepend($obj);
      } else {
        (pos !== undefined) ? slider.slides.eq(pos).before($obj) : slider.container.append($obj);
      }
      slider.update(pos, "add"); // Update slider state.
      slider.slides = $(slider.vars.selector + ':not(.clone)', slider); // Re-cache slides.
      slider.setup(); // Re-setup the slider.
      slider.vars.added(slider); // API: added() callback.
    };

    /**
     * Removes a slide from the slider.
     * @param {jQuery|HTMLElement|number} obj - Slide element or index to remove.
     */
    slider.removeSlide = function(obj) {
      var pos = (isNaN(obj)) ? slider.slides.index($(obj)) : obj; // Get index if obj is element.
      slider.count -= 1;
      slider.last = slider.count - 1;
      // Remove slide.
      if (isNaN(obj)) { $(obj, slider.slides).remove(); }
      else { (vertical && reverse) ? slider.slides.eq(slider.last).remove() : slider.slides.eq(obj).remove(); }
      slider.doMath(); // Recalculate.
      slider.update(pos, "remove"); // Update state.
      slider.slides = $(slider.vars.selector + ':not(.clone)', slider); // Re-cache.
      slider.setup(); // Re-setup.
      slider.vars.removed(slider); // API: removed() callback.
    };

    //FlexSlider: Initialize - Calls the main init method.
    methods.init();
  }; // End $.flexslider

  // Window blur/focus event handling to pause/play slideshow.
  $( window ).blur( function ( e ) {
    focused = false; // Window lost focus.
  }).focus( function ( e ) {
    focused = true; // Window gained focus.
  });

  // FlexSlider: Default Settings Object
  // Users can override these defaults when initializing a slider.
  $.flexslider.defaults = {
    namespace: "flex-",             // String: Prefix for CSS classes.
    selector: ".slides > li",       // Selector: Pattern for slides within the container.
    animation: "fade",              // String: "fade" or "slide".
    easing: "swing",                // String: Easing method for jQuery transitions.
    direction: "horizontal",        // String: "horizontal" or "vertical".
    reverse: false,                 // Boolean: Reverse animation direction.
    animationLoop: true,            // Boolean: Loop the animation.
    smoothHeight: false,            // Boolean: Animate slider height smoothly in horizontal mode.
    startAt: 0,                     // Integer: Starting slide index.
    slideshow: true,                // Boolean: Auto-animate slider.
    slideshowSpeed: 7000,           // Integer: Slideshow cycle speed (ms).
    animationSpeed: 600,            // Integer: Animation speed (ms).
    initDelay: 0,                   // Integer: Initial delay before slideshow starts (ms).
    randomize: false,               // Boolean: Randomize slide order.
    fadeFirstSlide: true,           // Boolean: Fade in the first slide for "fade" animation.
    thumbCaptions: false,           // Boolean: Show captions on thumbnails.

    // Usability features
    pauseOnAction: true,            // Boolean: Pause slideshow on control interaction.
    pauseOnHover: false,            // Boolean: Pause slideshow on hover.
    pauseInvisible: true,           // Boolean: Pause slideshow when tab is invisible.
    useCSS: true,                   // Boolean: Use CSS3 transitions if available.
    touch: true,                    // Boolean: Allow touch swipe navigation.
    video: false,                   // Boolean: Set to true if using video to prevent CSS3 3D transform issues.

    // Primary Controls
    controlNav: true,               // Boolean: Create paging control navigation.
    directionNav: true,             // Boolean: Create prev/next arrow navigation.
    prevText: "Previous",           // String: Text for "previous" button.
    nextText: "Next",               // String: Text for "next" button.

    // Secondary Navigation
    keyboard: true,                 // Boolean: Allow keyboard navigation (left/right keys).
    multipleKeyboard: false,        // Boolean: Allow keyboard navigation for multiple sliders on one page.
    mousewheel: false,              // Boolean: Allow mousewheel navigation (requires jquery.mousewheel.js).
    pausePlay: false,               // Boolean: Create dynamic pause/play element.
    pauseText: "Pause",             // String: Text for "pause" button.
    playText: "Play",               // String: Text for "play" button.

    // Special properties
    controlsContainer: "",          // jQuery Object/Selector: Container for navigation elements.
    manualControls: "",             // jQuery Object/Selector: Custom control navigation elements.
    customDirectionNav: "",         // jQuery Object/Selector: Custom prev/next buttons.
    sync: "",                       // Selector: Slider to synchronize actions with.
    asNavFor: "",                   // Selector: Turns this slider into thumbnail navigation for another.

    // Carousel Options
    itemWidth: 0,                   // Integer: Width of individual carousel items (including padding/border).
    itemMargin: 0,                  // Integer: Margin between carousel items.
    minItems: 1,                    // Integer: Minimum visible carousel items.
    maxItems: 0,                    // Integer: Maximum visible carousel items.
    move: 0,                        // Integer: Number of items to move per animation (0 for all visible).
    allowOneSlide: true,            // Boolean: Allow slider with a single slide.

    // Browser Specific (seems to be set dynamically, not typically a user option)
    isFirefox: false,               // Boolean: True if browser is Firefox.

    // Callback API
    start: function(){},            // Callback: Fires when the first slide loads. function(slider)
    before: function(){},           // Callback: Fires before each animation. function(slider)
    after: function(){},            // Callback: Fires after each animation. function(slider)
    end: function(){},              // Callback: Fires when the slider reaches the last slide (non-looping). function(slider)
    added: function(){},            // Callback: Fires after a slide is added. function(slider)
    removed: function(){},          // Callback: Fires after a slide is removed. function(slider)
    init: function() {},            // Callback: Fires after slider is initially set up. function(slider)
    rtl: false                      // Boolean: Enable Right-to-Left mode.
  };

  // FlexSlider: Plugin Function Definition
  // This is how the plugin is invoked on a jQuery selection (e.g., $('.flexslider').flexslider();)
  $.fn.flexslider = function(options) {
    if (options === undefined) { options = {}; } // Default to empty options if none provided.

    if (typeof options === "object") { // If options is an object, initialize the slider.
      return this.each(function() { // Iterate over each selected element.
        var $this = $(this),
            selector = (options.selector) ? options.selector : ".slides > li", // Determine slide selector.
            $slides = $this.find(selector); // Find slides within the current element.

        // Handle cases with one slide or no slides based on allowOneSlide option.
        if ( ( $slides.length === 1 && options.allowOneSlide === false ) || $slides.length === 0 ) {
          $slides.fadeIn(400); // Simple fade-in for single/no slides.
          if (options.start) { options.start($this); } // Call start callback if provided.
        } else if ($this.data('flexslider') === undefined) { // If slider not already initialized on this element.
          new $.flexslider(this, options); // Create a new FlexSlider instance.
        }
      });
    } else { // If options is a string, it's a command to control an existing slider.
      var $slider = $(this).data('flexslider'); // Get the FlexSlider instance from element data.
      switch (options) { // Execute command.
        case "play": $slider.play(); break;
        case "pause": $slider.pause(); break;
        case "stop": $slider.stop(); break;
        case "next": $slider.flexAnimate($slider.getTarget("next"), true); break;
        case "prev":
        case "previous": $slider.flexAnimate($slider.getTarget("prev"), true); break;
        default: if (typeof options === "number") { $slider.flexAnimate(options, true); } // Animate to specific slide index.
      }
    }
  };
})(jQuery); // End of IIFE, pass jQuery to it.
