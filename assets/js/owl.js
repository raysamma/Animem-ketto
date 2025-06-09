/**
 * Owl Carousel v2.3.4
 * Copyright 2013-2018 David Deutsch
 * Licensed under: SEE LICENSE IN https://github.com/OwlCarousel2/OwlCarousel2/blob/master/LICENSE
 *
 * This is the Owl Carousel v2.3.4 jQuery plugin.
 * It's a feature-rich, responsive, and touch-friendly carousel library.
 * Comments below are added for understanding its structure, core functionality, plugins, and API.
 */

// IIFE (Immediately Invoked Function Expression) to create a private scope.
// It supports jQuery and Zepto.
;(function($, window, document, undefined) {

	/**
	 * Creates a carousel.
	 * @class The Owl Carousel.
	 * @public
	 * @param {HTMLElement|jQuery} element - The element to create the carousel for.
	 * @param {Object} [options] - The options for this carousel.
	 */
	function Owl(element, options) {

		/**
		 * Current settings for the carousel.
		 * @public
		 */
		this.settings = null;

		/**
		 * Current options set by the caller including defaults.
		 * @public
		 */
		this.options = $.extend({}, Owl.Defaults, options); // Merges user options with defaults.

		/**
		 * Plugin element.
		 * @public
		 */
		this.$element = $(element); // The jQuery object for the carousel element.

		/**
		 * Proxied event handlers.
		 * @protected
		 */
		this._handlers = {}; // Stores bound event handlers for easy removal.

		/**
		 * References to the running plugins of this carousel.
		 * @protected
		 */
		this._plugins = {}; // Stores instances of active plugins.

		/**
		 * Currently suppressed events to prevent them from being retriggered.
		 * @protected
		 */
		this._supress = {}; // Manages event suppression.

		/**
		 * Absolute current position.
		 * @protected
		 */
		this._current = null; // Index of the current item.

		/**
		 * Animation speed in milliseconds.
		 * @protected
		 */
		this._speed = null;

		/**
		 * Coordinates of all items in pixel.
		 * @protected
		 */
		this._coordinates = []; // Stores x/y coordinates of items.

		/**
		 * Current breakpoint. Used for responsive design.
		 * @protected
		 */
		this._breakpoint = null;

		/**
		 * Current width of the plugin element.
		 */
		this._width = null;

		/**
		 * All real items (excluding clones).
		 * @protected
		 */
		this._items = [];

		/**
		 * All cloned items (for looping).
		 * @protected
		 */
		this._clones = [];

		/**
		 * Merge values of all items (for items spanning multiple widths).
		 * @protected
		 */
		this._mergers = [];

		/**
		 * Widths of all items.
		 */
		this._widths = [];

		/**
		 * Invalidated parts within the update process (e.g., 'items', 'settings', 'width').
		 * @protected
		 */
		this._invalidated = {};

		/**
		 * Ordered list of workers (functions) for the update process.
		 * @protected
		 */
		this._pipe = [];

		/**
		 * Current state information for the drag operation.
		 * @protected
		 */
		this._drag = {
			time: null, // Timestamp of drag start.
			target: null, // Element that initiated the drag.
			pointer: null, // Initial pointer coordinates.
			stage: { // Stage coordinates at drag start and current.
				start: null,
				current: null
			},
			direction: null // Direction of the drag ('left' or 'right').
		};

		/**
		 * Current state information and their tags (e.g., 'busy', 'interacting').
		 * @type {Object}
		 * @protected
		 */
		this._states = {
			current: {}, // Holds current active states and their counts.
			tags: { // Defines relationships between states.
				'initializing': [ 'busy' ],
				'animating': [ 'busy' ],
				'dragging': [ 'interacting' ]
			}
		};

		// Proxy event handlers for 'onResize' and 'onThrottledResize' to maintain 'this' context.
		$.each([ 'onResize', 'onThrottledResize' ], $.proxy(function(i, handler) {
			this._handlers[handler] = $.proxy(this[handler], this);
		}, this));

		// Initialize all registered plugins.
		$.each(Owl.Plugins, $.proxy(function(key, plugin) {
			this._plugins[key.charAt(0).toLowerCase() + key.slice(1)]
				= new plugin(this);
		}, this));

		// Initialize all registered workers for the update pipe.
		$.each(Owl.Workers, $.proxy(function(priority, worker) {
			this._pipe.push({
				'filter': worker.filter, // Parts that trigger this worker.
				'run': $.proxy(worker.run, this) // The worker function.
			});
		}, this));

		this.setup(); // Calculate initial settings based on options and viewport.
		this.initialize(); // Initialize the carousel DOM structure and event handlers.
	}

	/**
	 * Default options for the carousel.
	 * @public
	 */
	Owl.Defaults = {
		items: 3, // Number of items to display.
		loop: false, // Infinite loop.
		center: false, // Center item.
		rewind: false, // Go backwards when the boundary has been reached.

		checkVisibility: true, // Check visibility of owl element.

		mouseDrag: true, // Enable mouse drag events.
		touchDrag: true, // Enable touch drag events.
		pullDrag: true, // Enable pulling of the carousel stage.
		freeDrag: false, // Enable free dragging without snapping to items.

		margin: 0, // Margin between items.
		stagePadding: 0, // Padding for stage.

		merge: false, // Merge items. Works with data-merge attributes on items.
		mergeFit: true, // Fit merged items within available width.
		autoWidth: false, // Set item width by CSS.

		startPosition: 0, // Start position or URL hash string.
		rtl: false, // Enable right-to-left direction.

		smartSpeed: 250, // Speed of smart transitions.
		fluidSpeed: false, // Speed of fluid transitions.
		dragEndSpeed: false, // Drag end speed.

		responsive: {}, // Object containing responsive breakpoints.
		responsiveRefreshRate: 200, // Responsive refresh rate.
		responsiveBaseElement: window, // Element to measure an responsive breakpoint.

		fallbackEasing: 'swing', // Easing for jQuery animations.
		slideTransition: '', // CSS3 transition style for slide.

		info: false, // Callback to retrieve internal information.

		nestedItemSelector: false, // Selector for nested items.
		itemElement: 'div', // Element type for items.
		stageElement: 'div', // Element type for stage.

		// CSS class names
		refreshClass: 'owl-refresh', // Class during refresh.
		loadedClass: 'owl-loaded', // Class after items are loaded.
		loadingClass: 'owl-loading', // Class during loading.
		rtlClass: 'owl-rtl', // Class for RTL mode.
		responsiveClass: 'owl-responsive', // Class for responsive mode.
		dragClass: 'owl-drag', // Class when dragging.
		itemClass: 'owl-item', // Class for individual items.
		stageClass: 'owl-stage', // Class for the stage.
		stageOuterClass: 'owl-stage-outer', // Class for the stage wrapper.
		grabClass: 'owl-grab' // Class for grab cursor.
	};

	/**
	 * Enumeration for width types.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Width = {
		Default: 'default', // Default width calculation.
		Inner: 'inner',   // Inner width.
		Outer: 'outer'    // Outer width.
	};

	/**
	 * Enumeration for event/state types.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Type = {
		Event: 'event', // Identifies an event.
		State: 'state'  // Identifies a state.
	};

	/**
	 * Contains all registered plugins.
	 * @public
	 */
	Owl.Plugins = {}; // Plugins add themselves to this object.

	/**
	 * List of workers involved in the update process.
	 * Each worker is an object with 'filter' (array of invalidated parts that trigger it)
	 * and 'run' (the function to execute).
	 */
	Owl.Workers = [ {
		// Updates the cached width of the carousel element.
		filter: [ 'width', 'settings' ],
		run: function() { this._width = this.$element.width(); }
	}, {
		// Caches the current item based on the current position.
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) { cache.current = this._items && this._items[this.relative(this._current)]; }
	}, {
		// Removes cloned items from the stage.
		filter: [ 'items', 'settings' ],
		run: function() { this.$stage.children('.cloned').remove(); }
	}, {
		// Sets default CSS for items (width auto, margins for RTL/LTR).
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) { /* ... sets item CSS ... */ }
	}, {
		// Calculates and caches widths of all items, considering merged items.
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) { /* ... calculates item widths ... */ }
	}, {
		// Creates and appends/prepends cloned items for looping functionality.
		filter: [ 'items', 'settings' ],
		run: function() { /* ... handles cloning ... */ }
	}, {
		// Calculates and caches the coordinates (positions) of all items including clones.
		filter: [ 'width', 'items', 'settings' ],
		run: function() { /* ... calculates coordinates ... */ }
	}, {
		// Sets the width and padding of the stage element.
		filter: [ 'width', 'items', 'settings' ],
		run: function() { /* ... sets stage CSS ... */ }
	}, {
		// Applies calculated widths to items if not autoWidth or if items are merged.
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) { /* ... applies item widths ... */ }
	}, {
		// Removes stage style if no coordinates (e.g., no items).
		filter: [ 'items' ],
		run: function() { this._coordinates.length < 1 && this.$stage.removeAttr('style'); }
	}, {
		// Resets the carousel to the current position after updates.
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) { /* ... resets to current position ... */ }
	}, {
		// Animates the stage to the current coordinate.
		filter: [ 'position' ],
		run: function() { this.animate(this.coordinates(this._current)); }
	}, {
		// Updates active and center classes on items based on their visibility in the viewport.
		filter: [ 'width', 'position', 'items', 'settings' ],
		run: function() { /* ... updates active/center classes ... */ }
	} ];

	/**
	 * Initializes the stage element (where items are placed).
	 * Creates it if it doesn't exist.
	 * @protected
	 */
	Owl.prototype.initializeStage = function() { /* ... stage DOM creation ... */ };

	/**
	 * Initializes item elements.
	 * If items exist, it processes them. Otherwise, it replaces content.
	 * @protected
	 */
	Owl.prototype.initializeItems = function() { /* ... item processing and DOM creation ... */ };

	/**
	 * Initializes the carousel: sets up RTL, preloads images for autoWidth,
	 * initializes stage and items, and registers event handlers.
	 * @protected
	 */
	Owl.prototype.initialize = function() { /* ... main initialization logic ... */ };

	/**
	 * Checks if the carousel element is currently visible in the DOM.
	 * Can be disabled by `checkVisibility: false` for performance.
	 * @returns {Boolean}
	 * @public
	 */
	Owl.prototype.isVisible = function() { /* ... visibility check ... */ };

	/**
	 * Setups the current settings based on responsive options and current viewport.
	 * @public
	 */
	Owl.prototype.setup = function() { /* ... responsive settings handling ... */ };

	/**
	 * Applies logic to options (e.g., autoWidth disables stagePadding and merge).
	 * @protected
	 */
	Owl.prototype.optionsLogic = function() { /* ... option dependencies ... */ };

	/**
	 * Prepares an item element before it's added to the stage.
	 * Wraps content in an item container if necessary.
	 * @param {HTMLElement|jQuery|String} item - The item content.
	 * @returns {jQuery} The prepared item container.
	 * @protected
	 */
	Owl.prototype.prepare = function(item) { /* ... item preparation ... */ };

	/**
	 * Runs the update pipeline (workers) to refresh the carousel state and view.
	 * @public
	 */
	Owl.prototype.update = function() { /* ... runs worker pipe ... */ };

	/**
	 * Gets the width of the carousel view.
	 * @param {Owl.Width} [dimension=Owl.Width.Default] - The type of width to get.
	 * @returns {Number} The width in pixels.
	 * @public
	 */
	Owl.prototype.width = function(dimension) { /* ... width calculation ... */ };

	/**
	 * Refreshes the carousel. Called on initialization, resize, or explicit refresh.
	 * @public
	 */
	Owl.prototype.refresh = function() { /* ... refresh sequence ... */ };

	/**
	 * Handles throttled window resize events.
	 * @protected
	 */
	Owl.prototype.onThrottledResize = function() { /* ... throttled resize logic ... */ };

	/**
	 * Handles window resize events. Invalidates width and refreshes.
	 * @protected
	 */
	Owl.prototype.onResize = function() { /* ... resize logic ... */ };

	/**
	 * Registers core event handlers (drag, touch, transitionend).
	 * @protected
	 */
	Owl.prototype.registerEventHandlers = function() { /* ... event registration ... */ };

	/**
	 * Handles `mousedown` and `touchstart` events to initiate dragging.
	 * @param {Event} event - The event object.
	 * @protected
	 */
	Owl.prototype.onDragStart = function(event) { /* ... drag start logic ... */ };

	/**
	 * Handles `mousemove` and `touchmove` events during dragging.
	 * @param {Event} event - The event object.
	 * @protected
	 */
	Owl.prototype.onDragMove = function(event) { /* ... drag move logic ... */ };

	/**
	 * Handles `mouseup` and `touchend` events to end dragging.
	 * @param {Event} event - The event object.
	 * @protected
	 */
	Owl.prototype.onDragEnd = function(event) { /* ... drag end logic ... */ };

	/**
	 * Finds the closest item index to a given coordinate during drag/swipe.
	 * @param {Number} coordinate - The target coordinate.
	 * @param {String} direction - The drag direction ('left' or 'right').
	 * @returns {Number} The index of the closest item.
	 * @protected
	 */
	Owl.prototype.closest = function(coordinate, direction) { /* ... find closest item ... */ };

	/**
	 * Animates the carousel stage to a new coordinate.
	 * Uses CSS transforms if supported, otherwise falls back to jQuery animate.
	 * @param {Number} coordinate - The target coordinate.
	 * @public
	 */
	Owl.prototype.animate = function(coordinate) { /* ... stage animation ... */ };

	/**
	 * Checks if the carousel is in a specific state (e.g., 'animating', 'dragging').
	 * @param {String} state - The state to check.
	 * @returns {Boolean} True if in the specified state.
	 * @public
	 */
	Owl.prototype.is = function(state) { /* ... state check ... */ };

	/**
	 * Gets or sets the current item's absolute position.
	 * @param {Number} [position] - New absolute position.
	 * @returns {Number} The current absolute position.
	 * @public
	 */
	Owl.prototype.current = function(position) { /* ... get/set current item ... */ };

	/**
	 * Invalidates a part of the carousel, forcing it to be recalculated during the next update.
	 * @param {String} [part] - The part to invalidate (e.g., 'items', 'settings', 'width').
	 * @public
	 */
	Owl.prototype.invalidate = function(part) { /* ... invalidate part ... */ };

	/**
	 * Resets the carousel to a specific absolute position without animation.
	 * @param {Number} position - The target absolute position.
	 * @public
	 */
	Owl.prototype.reset = function(position) { /* ... reset position ... */ };

	/**
	 * Normalizes an item position, handling loops and boundaries.
	 * @param {Number} position - The position to normalize.
	 * @param {Boolean} [relative=false] - Whether the input position is relative.
	 * @returns {Number} The normalized absolute position.
	 * @public
	 */
	Owl.prototype.normalize = function(position, relative) { /* ... normalize position ... */ };

	/**
	 * Converts an absolute position to a relative one (within the real items).
	 * @param {Number} position - The absolute position.
	 * @returns {Number} The relative position.
	 * @public
	 */
	Owl.prototype.relative = function(position) { /* ... absolute to relative ... */ };

	/**
	 * Gets the maximum valid item position.
	 * @param {Boolean} [relative=false] - Whether to return relative or absolute position.
	 * @returns {Number}
	 * @public
	 */
	Owl.prototype.maximum = function(relative) { /* ... get max position ... */ };

	/**
	 * Gets the minimum valid item position.
	 * @param {Boolean} [relative=false] - Whether to return relative or absolute position.
	 * @returns {Number}
	 * @public
	 */
	Owl.prototype.minimum = function(relative) { /* ... get min position ... */ };

	/**
	 * Gets item elements.
	 * @param {Number} [position] - Relative position to get a specific item.
	 * @returns {jQuery|Array.<jQuery>} A specific item or all items.
	 * @public
	 */
	Owl.prototype.items = function(position) { /* ... get items ... */ };

	/**
	 * Gets merge data for items.
	 * @param {Number} [position] - Relative position to get merge data for a specific item.
	 * @returns {Number|Array.<Number>} Merge data for an item or all items.
	 * @public
	 */
	Owl.prototype.mergers = function(position) { /* ... get mergers ... */ };

	/**
	 * Gets cloned item elements for a specific original item.
	 * @param {Number} [position] - Relative position of the original item.
	 * @returns {Array.<Number>} Absolute positions of clones or all clone positions.
	 * @public
	 */
	Owl.prototype.clones = function(position) { /* ... get clones ... */ };

	/**
	 * Gets or sets the animation speed.
	 * @param {Number} [speed] - New animation speed in ms.
	 * @returns {Number} Current animation speed.
	 * @public
	 */
	Owl.prototype.speed = function(speed) { /* ... get/set speed ... */ };

	/**
	 * Gets the coordinate for a specific item position.
	 * @param {Number} position - Absolute position of the item.
	 * @returns {Number|Array.<Number>} Coordinate of the item or all coordinates.
	 * @public
	 */
	Owl.prototype.coordinates = function(position) { /* ... get coordinates ... */ };

	/**
	 * Calculates animation duration between two items.
	 * @param {Number} from - Absolute start position.
	 * @param {Number} to - Absolute end position.
	 * @param {Number} [factor] - Speed factor.
	 * @returns {Number} Animation duration in ms.
	 * @protected
	 */
	Owl.prototype.duration = function(from, to, factor) { /* ... calculate duration ... */ };

	/**
	 * Navigates to a specific item.
	 * @param {Number} position - Target relative position.
	 * @param {Number} [speed] - Animation speed.
	 * @public
	 */
	Owl.prototype.to = function(position, speed) { /* ... navigate to item ... */ };

	/**
	 * Navigates to the next item.
	 * @param {Number} [speed] - Animation speed.
	 * @public
	 */
	Owl.prototype.next = function(speed) { /* ... navigate next ... */ };

	/**
	 * Navigates to the previous item.
	 * @param {Number} [speed] - Animation speed.
	 * @public
	 */
	Owl.prototype.prev = function(speed) { /* ... navigate previous ... */ };

	/**
	 * Handles the end of a CSS transition or jQuery animation.
	 * @param {Event} [event] - The event object.
	 * @protected
	 */
	Owl.prototype.onTransitionEnd = function(event) { /* ... transition/animation end ... */ };

	/**
	 * Gets the width of the responsive base element (usually window).
	 * @returns {Number} Viewport width in pixels.
	 * @protected
	 */
	Owl.prototype.viewport = function() { /* ... get viewport width ... */ };

	/**
	 * Replaces all items in the carousel with new content.
	 * @param {HTMLElement|jQuery|String} content - New content.
	 * @public
	 */
	Owl.prototype.replace = function(content) { /* ... replace content ... */ };

	/**
	 * Adds a new item to the carousel.
	 * @param {HTMLElement|jQuery|String} content - Item content to add.
	 * @param {Number} [position] - Relative position to insert at.
	 * @public
	 */
	Owl.prototype.add = function(content, position) { /* ... add item ... */ };

	/**
	 * Removes an item from the carousel by its relative position.
	 * @param {Number} position - Relative position of the item to remove.
	 * @public
	 */
	Owl.prototype.remove = function(position) { /* ... remove item ... */ };

	/**
	 * Preloads images for items when `autoWidth` is enabled.
	 * @param {jQuery} images - jQuery collection of images to preload.
	 * @protected
	 */
	Owl.prototype.preloadAutoWidthImages = function(images) { /* ... preload images for autoWidth ... */ };

	/**
	 * Destroys the carousel instance, removes DOM elements, and unbinds event handlers.
	 * @public
	 */
	Owl.prototype.destroy = function() { /* ... destroy carousel ... */ };

	/**
	 * Helper function for comparing numbers, considering RTL settings.
	 * @param {Number} a - First number.
	 * @param {String} o - Operator (e.g., '<', '>').
	 * @param {Number} b - Second number.
	 * @returns {Boolean}
	 * @protected
	 */
	Owl.prototype.op = function(a, o, b) { /* ... RTL-aware comparison ... */ };

	/**
	 * Cross-browser event attachment.
	 * @param {HTMLElement} element
	 * @param {String} event
	 * @param {Function} listener
	 * @param {Boolean} capture
	 * @protected
	 */
	Owl.prototype.on = function(element, event, listener, capture) { /* ... attach event ... */ };

	/**
	 * Cross-browser event detachment.
	 * @param {HTMLElement} element
	 * @param {String} event
	 * @param {Function} listener
	 * @param {Boolean} capture
	 * @protected
	 */
	Owl.prototype.off = function(element, event, listener, capture) { /* ... detach event ... */ };

	/**
	 * Triggers an event on the carousel element.
	 * @param {String} name - Event name.
	 * @param {*} [data=null] - Event data.
	 * @param {String} [namespace=carousel] - Event namespace.
	 * @param {String} [state] - Associated state.
	 * @param {Boolean} [enter=false] - If entering a state.
	 * @returns {Event} The jQuery event object.
	 * @protected
	 */
	Owl.prototype.trigger = function(name, data, namespace, state, enter) { /* ... trigger event ... */ };

	/**
	 * Enters a carousel state (e.g., 'busy', 'dragging').
	 * @param {String} name - State name.
	 * @public
	 */
	Owl.prototype.enter = function(name) { /* ... enter state ... */ };

	/**
	 * Leaves a carousel state.
	 * @param {String} name - State name.
	 * @public
	 */
	Owl.prototype.leave = function(name) { /* ... leave state ... */ };

	/**
	 * Registers an event or state type with jQuery's special event system or internal state tags.
	 * @param {Object} object - Object describing the event or state.
	 * @public
	 */
	Owl.prototype.register = function(object) { /* ... register event/state type ... */ };

	/**
	 * Suppresses specified events from being triggered.
	 * @param {Array.<String>} events - Array of event names to suppress.
	 * @protected
	 */
	Owl.prototype.suppress = function(events) { /* ... suppress events ... */ };

	/**
	 * Releases suppression for specified events.
	 * @param {Array.<String>} events - Array of event names to release.
	 * @protected
	 */
	Owl.prototype.release = function(events) { /* ... release events ... */ };

	/**
	 * Gets unified pointer coordinates (x, y) from a mouse or touch event.
	 * @param {Event} event - The event object.
	 * @returns {Object} Object with x and y coordinates.
	 * @protected
	 */
	Owl.prototype.pointer = function(event) { /* ... get pointer coordinates ... */ };

	/**
	 * Checks if a value is numeric.
	 * @param {*} number - Value to check.
	 * @returns {Boolean}
	 * @protected
	 */
	Owl.prototype.isNumeric = function(number) { /* ... check if numeric ... */ };

	/**
	 * Calculates the difference between two coordinate objects.
	 * @param {Object} first - First coordinate object {x, y}.
	 * @param {Object} second - Second coordinate object {x, y}.
	 * @returns {Object} Difference object {x, y}.
	 * @protected
	 */
	Owl.prototype.difference = function(first, second) { /* ... calculate coordinate difference ... */ };

	/**
	 * The jQuery Plugin for the Owl Carousel.
	 * Handles initialization and method calls on jQuery selections.
	 * e.g., $('.owl-carousel').owlCarousel(options);
	 * or $('.owl-carousel').owlCarousel('next');
	 * @public
	 */
	$.fn.owlCarousel = function(option) { /* ... jQuery plugin definition ... */ };

	/**
	 * The constructor for the jQuery Plugin.
	 * @public
	 */
	$.fn.owlCarousel.Constructor = Owl;

})(window.Zepto || window.jQuery, window, document); // End of Core Owl Carousel IIFE

/**
 * AutoRefresh Plugin for Owl Carousel
 * Watches for visibility changes to refresh the carousel.
 * @version 2.3.4
 */
;(function($, window, document, undefined) {
	// AutoRefresh Plugin Constructor
	var AutoRefresh = function(carousel) { /* ... AutoRefresh plugin logic ... */ };
	AutoRefresh.Defaults = { autoRefresh: true, autoRefreshInterval: 500 };
	AutoRefresh.prototype.watch = function() { /* ... watch for visibility ... */ };
	AutoRefresh.prototype.refresh = function() { /* ... refresh on visibility change ... */ };
	AutoRefresh.prototype.destroy = function() { /* ... destroy AutoRefresh ... */ };
	$.fn.owlCarousel.Constructor.Plugins.AutoRefresh = AutoRefresh;
})(window.Zepto || window.jQuery, window, document);

/**
 * Lazy Load Plugin for Owl Carousel
 * Delays loading of images until they are (nearly) visible.
 * @version 2.3.4
 */
;(function($, window, document, undefined) {
	// Lazy Load Plugin Constructor
	var Lazy = function(carousel) { /* ... Lazy Load plugin logic ... */ };
	Lazy.Defaults = { lazyLoad: false, lazyLoadEager: 0 };
	Lazy.prototype.load = function(position) { /* ... load image for item ... */ };
	Lazy.prototype.destroy = function() { /* ... destroy Lazy Load ... */ };
	$.fn.owlCarousel.Constructor.Plugins.Lazy = Lazy;
})(window.Zepto || window.jQuery, window, document);

/**
 * AutoHeight Plugin for Owl Carousel
 * Adjusts carousel height to the height of the current visible item(s).
 * @version 2.3.4
 */
;(function($, window, document, undefined) {
	// AutoHeight Plugin Constructor
	var AutoHeight = function(carousel) { /* ... AutoHeight plugin logic ... */ };
	AutoHeight.Defaults = { autoHeight: false, autoHeightClass: 'owl-height' };
	AutoHeight.prototype.update = function() { /* ... update height ... */ };
	AutoHeight.prototype.destroy = function() { /* ... destroy AutoHeight ... */ };
	$.fn.owlCarousel.Constructor.Plugins.AutoHeight = AutoHeight;
})(window.Zepto || window.jQuery, window, document);

/**
 * Video Plugin for Owl Carousel
 * Enables embedding and controlling videos (YouTube, Vimeo, Vzaar) within the carousel.
 * @version 2.3.4
 */
;(function($, window, document, undefined) {
	// Video Plugin Constructor
	var Video = function(carousel) { /* ... Video plugin logic ... */ };
	Video.Defaults = { video: false, videoHeight: false, videoWidth: false };
	Video.prototype.fetch = function(target, item) { /* ... fetch video info ... */ };
	Video.prototype.thumbnail = function(target, video) { /* ... create video thumbnail ... */ };
	Video.prototype.stop = function() { /* ... stop video ... */ };
	Video.prototype.play = function(event) { /* ... play video ... */ };
	Video.prototype.isInFullScreen = function() { /* ... check fullscreen ... */ };
	Video.prototype.destroy = function() { /* ... destroy Video plugin ... */ };
	$.fn.owlCarousel.Constructor.Plugins.Video = Video;
})(window.Zepto || window.jQuery, window, document);

/**
 * Animate Plugin for Owl Carousel
 * Integrates with Animate.css to apply animations during slide transitions.
 * @version 2.3.4
 */
;(function($, window, document, undefined) {
	// Animate Plugin Constructor
	var Animate = function(scope) { /* ... Animate plugin logic ... */ };
	Animate.Defaults = { animateOut: false, animateIn: false };
	Animate.prototype.swap = function() { /* ... swap animation classes ... */ };
	Animate.prototype.clear = function(e) { /* ... clear animation classes ... */ };
	Animate.prototype.destroy = function() { /* ... destroy Animate plugin ... */ };
	$.fn.owlCarousel.Constructor.Plugins.Animate = Animate;
})(window.Zepto || window.jQuery, window, document);

/**
 * Autoplay Plugin for Owl Carousel
 * Enables automatic cycling of carousel items.
 * @version 2.3.4
 */
;(function($, window, document, undefined) {
	// Autoplay Plugin Constructor
	var Autoplay = function(carousel) { /* ... Autoplay plugin logic ... */ };
	Autoplay.Defaults = { autoplay: false, autoplayTimeout: 5000, autoplayHoverPause: false, autoplaySpeed: false };
	Autoplay.prototype._next = function(speed) { /* ... internal next slide logic for autoplay ... */ };
	Autoplay.prototype.read = function() { /* ... read autoplay timer ... */ };
	Autoplay.prototype.play = function(timeout, speed) { /* ... start autoplay ... */ };
	Autoplay.prototype.stop = function() { /* ... stop autoplay ... */ };
	Autoplay.prototype.pause = function() { /* ... pause autoplay ... */ };
	Autoplay.prototype.destroy = function() { /* ... destroy Autoplay plugin ... */ };
	$.fn.owlCarousel.Constructor.Plugins.autoplay = Autoplay;
})(window.Zepto || window.jQuery, window, document);

/**
 * Navigation Plugin for Owl Carousel
 * Provides next/prev buttons and dot navigation.
 * @version 2.3.4
 */
;(function($, window, document, undefined) {
	'use strict';
	// Navigation Plugin Constructor
	var Navigation = function(carousel) { /* ... Navigation plugin logic ... */ };
	Navigation.Defaults = { /* ... nav/dots options ... */ };
	Navigation.prototype.initialize = function() { /* ... init nav/dots DOM ... */ };
	Navigation.prototype.destroy = function() { /* ... destroy nav/dots ... */ };
	Navigation.prototype.update = function() { /* ... update nav/dots state ... */ };
	Navigation.prototype.draw = function() { /* ... draw nav/dots UI ... */ };
	Navigation.prototype.onTrigger = function(event) { /* ... extend event data with page info ... */ };
	Navigation.prototype.current = function() { /* ... get current page ... */ };
	Navigation.prototype.getPosition = function(successor) { /* ... get target position for nav ... */ };
	Navigation.prototype.next = function(speed) { /* ... nav next override ... */ };
	Navigation.prototype.prev = function(speed) { /* ... nav prev override ... */ };
	Navigation.prototype.to = function(position, speed, standard) { /* ... nav to override ... */ };
	$.fn.owlCarousel.Constructor.Plugins.Navigation = Navigation;
})(window.Zepto || window.jQuery, window, document);

/**
 * URL Hash Navigation Plugin for Owl Carousel
 * Allows linking directly to specific slides using URL hashes.
 * @version 2.3.4
 */
;(function($, window, document, undefined) {
	'use strict';
	// Hash Plugin Constructor
	var Hash = function(carousel) { /* ... Hash plugin logic ... */ };
	Hash.Defaults = { URLhashListener: false };
	Hash.prototype.destroy = function() { /* ... destroy Hash plugin ... */ };
	$.fn.owlCarousel.Constructor.Plugins.Hash = Hash;
})(window.Zepto || window.jQuery, window, document);

/**
 * Support Plugin for Owl Carousel (Internal)
 * Provides feature detection for CSS transforms and transitions, similar to Modernizr.
 * Sets $.support.transition, $.support.animation, $.support.transform, $.support.transform3d.
 * @version 2.3.4
 */
;(function($, window, document, undefined) {
	// Feature detection logic
	var style = $('<support>').get(0).style, // Create a dummy element for testing styles
		prefixes = 'Webkit Moz O ms'.split(' '), // CSS vendor prefixes
		events = { /* ... event names for transitions/animations ... */ },
		tests = { /* ... feature test functions ... */ };

	function test(property, prefixed) { /* ... tests a CSS property ... */ }
	function prefixed(property) { /* ... gets prefixed property name ... */ }

	// Perform tests and set $.support properties
	if (tests.csstransitions()) { /* ... set $.support.transition ... */ }
	if (tests.cssanimations()) { /* ... set $.support.animation ... */ }
	if (tests.csstransforms()) { /* ... set $.support.transform and $.support.transform3d ... */ }

})(window.Zepto || window.jQuery, window, document);