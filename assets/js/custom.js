/*
 * Custom JavaScript for Animemāketto / Pixie Template
 *
 * This file includes custom JavaScript functionalities, primarily focused on
 * initializing and configuring jQuery plugins used across the website.
 * These plugins enhance user experience with features like carousels,
 * filterable grids, and image sliders.
 *
 * Requires jQuery library to be loaded before this script.
 */

// Ensures the code runs only after the DOM is fully loaded and ready for manipulation.
jQuery( document ).ready(function( $ ) {

	// Enforces stricter parsing and error handling in JavaScript.
	"use strict";

	// Initialize Owl Carousel
	// Selects all elements with the class 'owl-carousel' to apply the carousel functionality.
	$('.owl-carousel').owlCarousel({
	    items:4, // Number of items to display by default.
	    lazyLoad:true, // Delays loading of images. Images outside of viewport are not loaded until user scrolls to them.
	    loop:true, // Enables continuous loop mode.
	    dots:true, // Shows navigation dots.
	    margin:20, // Margin between items in pixels.
	    responsiveClass:true, // Adds responsive CSS classes to the carousel.
		    responsive:{ // Defines different settings for various screen sizes.
		        0:{ // For screen widths 0px and up
		            items:1, // Show 1 item.
		        },
		        600:{ // For screen widths 600px and up
		            items:2, // Show 2 items.
		        },
		        1000:{ // For screen widths 1000px and up
		            items:4, // Show 4 items.
		        }
		    }
	});

	/*
	 * Activate jQuery Isotope for filtering and layout
	 * Targets a container with the class '.posts' which holds items with the class '.item'.
	 */
	var $container = $('.posts').isotope({
	    itemSelector : '.item', // Specifies the selector for individual filterable items.
	    isFitWidth: true // Adjusts the container width to fit the grid.
	});

	// Re-layout Isotope grid on window resize.
	// smartresize is likely a custom event or a part of a helper library to optimize resize event handling.
	$(window).smartresize(function(){
	    $container.isotope({
	      columnWidth: '.col-sm-3' // Defines the width of columns, often based on a Bootstrap grid class.
	    });
	});

	// Initialize Isotope with a default filter to show all items.
	$container.isotope({ filter: '*' });

	// Filter items on button click.
	// Attaches a click event listener to buttons within the element with ID '#filters'.
	$('#filters').on( 'click', 'button', function() {
	    var filterValue = $(this).attr('data-filter'); // Gets the filter value from the 'data-filter' attribute of the clicked button.
	    $container.isotope({ filter: filterValue }); // Applies the filter to the Isotope container.
	});


	/*
	 * Initialize FlexSlider for product image gallery (thumbnail navigation).
	 * This is likely the thumbnail slider.
	 */
	$('#carousel').flexslider({
	    animation: "slide", // Type of animation.
	    controlNav: false, // Disable the default navigation controls (usually dots).
	    animationLoop: false, // Disable continuous loop of the animation.
	    slideshow: false, // Disable automatic slideshow.
	    itemWidth: 210, // Width of each item in the thumbnail slider.
	    itemMargin: 5, // Margin between thumbnail items.
	    asNavFor: '#slider' // Links this thumbnail slider as navigation for the main slider ('#slider').
	});

	/*
	 * Initialize FlexSlider for product image gallery (main image display).
	 * This is likely the main image slider.
	 */
	$('#slider').flexslider({
	    animation: "slide", // Type of animation.
	    controlNav: false, // Disable the default navigation controls.
	    animationLoop: false, // Disable continuous loop.
	    slideshow: false, // Disable automatic slideshow.
	    sync: "#carousel" // Synchronizes this slider with the thumbnail slider ('#carousel').
	});
 
});
