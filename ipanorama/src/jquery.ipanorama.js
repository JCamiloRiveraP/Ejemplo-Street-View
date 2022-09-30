/*!
  iPanorama 360 - jQuery Virtual Tour
  @name jquery.ipanorama.js
  @description a jQuery plugin for creating a 360 degrees panorama viewer and virtual tours
  @version 1.3.3
  @author Max Lawrence
  @site http://www.avirtum.com
  @copyright (c) 2016 Max Lawrence (http://www.avirtum.com)
*/
(function($) {
	"use strict";
	
	var Util = (
		function() {
			function Util() {
			}
			
			Util.prototype.css2json = function(css) {
				var s = {};
				if (!css) return s;
				if (css instanceof CSSStyleDeclaration) {
					for (var i in css) {
						if ((css[i]).toLowerCase) {
							s[(css[i]).toLowerCase()] = (css[css[i]]);
						}
					}
				} else if (typeof css == "string") {
					css = css.split(";");
					for (var i in css) {
						var l = css[i].split(":");
						if(l.length == 2) {
							s[l[0].toLowerCase().trim()] = (l[1].trim());
						}
					}
				}
				return s;
			};
			
			Util.prototype.webgl = function() {
				try {
					var canvas = document.createElement( "canvas" );
					return !!( window.WebGLRenderingContext && (
						canvas.getContext( 'webgl' ) ||
						canvas.getContext( 'experimental-webgl' ) )
					);
				} catch ( e ) {
					return false;
				}
			};
			
			Util.prototype.isiOS = function() {
				var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
				return iOS;
			};

			Util.prototype.isMobile = function(agent) {
				return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(agent);
			};

			Util.prototype.isTransition = function() {
				var transition = ['transition', 'MozTransition', 'WebkitTransition', 'OTransition', 'msTransition', 'KhtmlTransition'],
				root = document.documentElement;
				for (var i = 0; i < transition.length; i++) {
					if (transition[i] in root.style) {
						return true;
					}
				}
				return false;
			},

			Util.prototype.animationEvent = function() {
				var el = document.createElement("fakeelement");

				var animations = {
					"animation" : "animationend",
					"MSAnimationEnd" : "msAnimationEnd",
					"OAnimation" : "oAnimationEnd",
					"MozAnimation" : "mozAnimationEnd",
					"WebkitAnimation" : "webkitAnimationEnd"
				}
				
				for (var i in animations){
					if (el.style[i] !== undefined){
						return animations[i];
					}
				}
			};
			
			return Util;
		}()
	);
	
	var ITEM_DATA_NAME = "ipanorama",
	INSTANCE_COUNTER = 0;
	
	function iPanorama(container, config) {
		this.config = null;
		this.container = null;
		this.controls = {};
		this.aspect = null;
		this.renderer = null;
		this.scene = null;
		this.material = null;
		this.sceneId = null;
		this.sceneIdArray = [];
		this.sceneIdThumbsArray = [];
		this.sceneThumbIndex = 0; // first visible scene thumb
		this.camera = null;
		this.hotSpots = [];
		this.hotSpotTimerId = null;
		this.hotSpotTimerDelay = 1000;
		this.zindex = 4;
		this.popover = false;
		this.popoverTemplate = null;
		this.popoverCloseManual = false;
		
		this.autoRotate = {
			enabled: false,
			speed: 0, // degrees per ms
		};
		this.yaw = {
			value: 0,
			valuePrev: 0,
			valueNext: 0,
			valueInit: 0,
			time: 0,
			duration: 0 // default 1000ms
		};
		this.pitch = {
			value: 0,
			valuePrev: 0,
			valueNext: 0,
			valueInit: 0,
			time: 0,
			duration: 0 // default 1000ms
		};
		this.zoom = {
			value: 75,
			valuePrev: 0,
			valueNext: 0,
			valueInit: 0,
			time: 0,
			duration: 0, // default 500ms
			min: 40,
			max: 100,
		};
		this.grabControl = {
			enabled: false,
			x: 0,
			y: 0,
			pitchSaved: 0,
			yawSaved: 0,
		};
		this.pinchZoom = {
			zoom: 0, // zoom value
			startDate: false, // used to calculate timing and aprox. acceleration
			aStartX: 0, // where finger "a" touch has started, left
			aStartY: 0, // where finger "a" touch has started, top
			aCurX: 0, // keeps finger "a" touch X position while moving on the screen
			aCurY: 0, // keeps finger "a" touch Y position while moving on the screen
			aIsMoving: false, // is user's finger "a" touching and moving?
			bStartX: 0, // where finger "b" touch has started, left
			bStartY: 0, // where finger "b" touch has started, top
			bCurX: 0, // keeps finger "b" touch X position while moving on the screen
			bCurY: 0, // keeps finger "b" touch Y position while moving on the screen
			bIsMoving: false // is user's finger "b" touching and moving?
		};
		this.sceneThumbsControl = {
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			topSaved: 0,
			leftSaved: 0
		};
		this.hoverGrabControl = {
			enabled: false,
			pitchSaved: 0,
			yawSaved: 0,
		},
		this.hotSpotSetupControl = {
			enabled: false,
			x: 0,
			y: 0,
			pitchSaved: 0,
			yawSaved: 0,
		};
		this.animating = false;
		this.loading = false;
		this.xhr = null;
		this.timePrev = null;
		this.timeNext = null;
		this.timeInteraction = Date.now();
		this.id = INSTANCE_COUNTER++;
		
		this.init(container, config);
	};
	
	iPanorama.prototype = {
		VERSION: "1.3.3",
		
		//=============================================
		// Properties & methods (is shared for all instances)
		//=============================================
		defaults: {
			theme: "ipnrm-theme-default", // CSS styles for controls, change it to match your own theme
			containerSizeSelector: null, // specify the selector for select a single element what define panorama size if the plugin can't detect it
			imagePreview: null, // specifies a URL for a preview image to display before the panorama is loaded
			autoLoad: false, // when set to true, the panorama will automatically load, when false, the user needs to click on the load button to load the panorama
			autoRotate: false, // setting this parameter causes the panorama to automatically rotate when loaded
			autoRotateSpeed: 0.001, // the value specifies the rotation speed in degrees per second, positive is counter-clockwise, and negative is clockwise
			autoRotateInactivityDelay: 3000, // sets the delay, in milliseconds, to start automatically rotating the panorama after user activity ceases, this parameter only has an effect if the autoRotate parameter is set
			mouseWheelPreventDefault: true, // enable or disable default behaviour on mouse wheel event
			mouseWheelDefaultRotate: false, // enable or disable rotating on mouse wheel
			mouseWheelRotate: false, // enable or disable rotating on mouse wheel
			mouseWheelRotateCoef: 0.2, // the coefficient by which the panorama is rotated on each mousewheel unit
			mouseWheelZoom: true, // enable or disable zooming on mouse wheel
			mouseWheelZoomCoef: 0.05, // the coefficient by which the panorama is zoomed on each mousewheel unit, this parameter only has an effect if the mouseWheelRotate parameter is set to false
			hoverGrab: false, // enable or disable grabbing on mouse hover
			hoverGrabYawCoef: 20, // the coefficient by which the yaw angle is changed on each mouse move unit
			hoverGrabPitchCoef: 20, // the coefficient by which the pitch angle is changed on each mouse move unit
			grab: true, // enable or disable grabbing on mouse click
			grabCoef: 0.1, // the coefficient by which the panorama is moved on each mouse grab unit
			showControlsOnHover: false, // determines whether the controls should be shown when hovering on the panorama
			showSceneThumbsCtrl: false, // show or hide the scene thumbs control
			showSceneMenuCtrl: false, // show or hide the scene menu control
			showSceneNextPrevCtrl: true, // show or hide the scene next and prev controls
			showShareCtrl: false, // show or hide the stereo view toggle control
			showZoomCtrl: true, // show or hide the zoom controls
			showFullscreenCtrl: true, // show or hide the fullscreen toggle control
			showAutoRotateCtrl: false, // show or hide the autorotate toggle control
			sceneThumbsVertical: true, // change scene thumbs's direction from horizontal to vertical
			sceneThumbsStatic: false, // change scene thumbs's direction from horizontal to vertical
			title: true, // show or hide the title control
			compass: true, // enable or disable the compass
			keyboardNav: true, // enable or disable navigation with keyboard (arrows keys)
			keyboardZoom: true, // enable or disable zoom with keyboard (plus and minus keys)
			pinchZoom: true, // enable or disable multitouchzoom (2 fingers touch on the screen at the same time)
			pinchZoomCoef: 0.1, // the coefficient by which the panorama is zoomed
			pinchZoomPreventDefault: true,
			sceneNextPrevLoop: false, // set or disable loop for the scene navigation with next & prev controls
			popover: true, // enable or disable the build-in popover system
			popoverTemplate: "<div class='ipnrm-popover'><div class='ipnrm-close'></div><div class='ipnrm-arrow'></div><div class='ipnrm-content'></div></div>", // // base HTML to use when creating the popover
			popoverPlacement: "top", // set the position of the popover on top, bottom, left, right, bottom-left, bottom-right, top-left or top-right side of the hotspot
			popoverShowTrigger: "hover", // specify how popover is triggered (click, hover)
			popoverHideTrigger: "leave", // specify how popover is hidden (click, leave, grab, manual)
			popoverShowClass: null, // specify the css3 animation class for the popover show
			popoverHideClass: null, // specify the css3 animation class for the popover hide
			hotSpotBelowPopover: true, // specify the z-order of the hotSpot against the popover
			sceneId: null, // id of the scene to load first
			sceneFadeDuration: 3000, // specify the fade duration, in milliseconds, when transitioning between scenes
			sceneBackgroundLoad: false, // load all scene in the background
			scenes: { // the definition of scene graph
				defaults: {
					type: "cube", // specify the scene type (cube, sphere, cylinder)
					cubeTextureCount: "six", // specify the cube texture count (single or six)
					sphereWidthSegments: 100, // number of horizontal segments for a sphere type scene
					sphereHeightSegments: 40, // number of vertical segments for a sphere type scene
					image: null, // full file name specify the background of the scene, for the 'cube' type scene you have to define six textures
					thumb: false, // // enable or disable the scene thumb
					thumbImage: null, // full file name specify the thumbnail of the scene
					yaw: 0, // sets the panorama’s starting yaw position in degrees
					pitch: 0, // sets the panorama’s starting pitch position in degrees
					zoom: 75, // sets the panorama’s starting zoom from 40 to 100
					title: null, // if set, the value is displayed as the panorama’s scene title, it can be text or HTML content
					titleSelector: null, // specify the selector for select a single element with a content for the title
					titleHtml: false, // specify the type of the scene title
					compassNorthOffset: null, // set the offset, in degrees, of the center of the panorama from North. As this affects the compass, it only has an effect if compass is set to true
					hotSpots: [], // specify an array of hot spots that can be links to other scenes or information
					saveCamera: true, // save scene yaw, pitch and zoom parameters
					pitchLimits: false, // enable or disable the pitch limits
					pitchLimitUp: 30,
					pitchLimitDown: 30,
					yawLimits: false, // enable or disable the yaw limits
					yawLimitLeft: 30,
					yawLimitRight: 30,
					// the definition of a hotSpot
					// title: null, // if set, the value is a hotspot title
					// yaw: 0 // specify the yaw portion of the hot spot’s location.
					// pitch: 0 // specify the pitch portion of the hot spot’s location
					// sceneId: null // specify the id of the scene to link to
					// imageUrl: null, // url for the hotspot image
					// imageWidth: null,
					// imageHeight: null,
					// link: null, // if set, the hotspot is a link
					// linkNewWindow: false, // if set, open link in new window
					// popoverShow: false, // show the popover content when the scene's loaded
					// popoverLazyload: true, // enable or disable lazy load for the popover content
					// popoverHtml: true // specify the type of the popover content
					// popoverWidth: null // set the custom width of the popover
					// popoverContent: null // if set, the value is displayed as the popover's content, it can be text or HTML content, or a method - function myfunc()
					// popoverSelector: null, // specify the selector for select a single element with a content for the popover
					// popoverSelectorDetach: false, // specify the selector for select a single element with a content for the popover
					// popoverPlacement: "top" // set the position of the popover on top, bottom, left or the right side of the hotspot
					// className: null // specify additional css classes
					// content: null // if set, the value is displayed as the hotspot's content
					// userData: null // specify the user data that is associated with the hotspot, useful when the popoverContent is a method
				},
			},
			mobile: false, // enable or disable the animation in the mobile browsers
			hotSpotSetup: false, // set or disable manual setup of hotspots in the current scene
			onHotSpotSetup: null, // function(yaw, pitch, cameraYaw, cameraPitch, cameraZoom, event) {} fire after hotspot setup
			onCameraUpdate: null, // function(cameraYaw, cameraPitch, cameraZoom) {} fire after the camera was updated
			onSceneChange: null, // function(oldSceneId, newSceneId) {} fire after the scene was changed
			onShare: null, // function(event) {} fire after the user click on the share control
			onLoad: null // function() {} fire after the ipanorama was loaded
		},
		
		cameraNearClipPlane: 0.1,
		cameraFarClipPlane: 1000,
		
		//=============================================
		// Methods
		//=============================================
		init: function(container, config) {
			//if(container.hasClass("ipnrm-ready")) {
			//	return;
			//}
			this.container = container;
			this.config = config;
			
			this.initScenes();
			this.loadSceneImages();
			this.initAutoRotate();
			this.create();
		},
		
		initScenes: function() {
			for (var key in this.config.scenes) {
				if (this.config.scenes.hasOwnProperty(key)) {
					var scene = $.extend({}, iPanorama.prototype.defaults.scenes.defaults, this.config.scenes[key]);
					
					scene._texturePreload = null;
					scene._texture = null;
					scene._yawInit = scene.yaw;
					scene._pitchInit = scene.pitch;
					scene._zoomInit = scene.zoom;
					
					this.config.scenes[key] = scene;
					this.sceneIdArray.push(key);
					
					if(scene.thumb) {
						this.sceneIdThumbsArray.push(key);
					}
				}
			}
		},
		
		getImagePortion: function(imgObj, width, height, x, y, ratio) {
			var canvas = document.createElement('canvas'),
			context = canvas.getContext('2d');
			
			canvas.width = width; 
			canvas.height = height;
			
			var bufferCanvas = document.createElement('canvas'),
			bufferContext = bufferCanvas.getContext('2d');
			
			bufferCanvas.width = imgObj.width;
			bufferCanvas.height = imgObj.height;
			bufferContext.drawImage(imgObj, 0, 0);
			
			context.drawImage(bufferCanvas, x, y, width * ratio, height * ratio, 0, 0, width, height);
			return canvas;
		},
		
		createCubeTextures: function(imgObj) {
			var w = imgObj.width / 6,
			h = imgObj.height,
			texture = {
				front:  this.getImagePortion(imgObj, w, h, w*0, 0, 1),
				right:  this.getImagePortion(imgObj, w, h, w*1, 0, 1),
				back:   this.getImagePortion(imgObj, w, h, w*2, 0, 1),
				left:   this.getImagePortion(imgObj, w, h, w*3, 0, 1),
				top:    this.getImagePortion(imgObj, w, h, w*4, 0, 1),
				bottom: this.getImagePortion(imgObj, w, h, w*5, 0, 1)
			}
			
			return texture;
		},
		
		loadSceneImages: function() {
			if(!this.config.sceneBackgroundLoad)
				return;
			
			var scenes = [];
			for (var key in this.config.scenes) {
				if (this.config.scenes.hasOwnProperty(key)) {
					var scene = this.config.scenes[key];
					
					if (typeof scene.image === "string") {
						scenes.push({scene: scene, imageType: 'image', imageUrl: scene.image});
					} else if(scene.image.hasOwnProperty("left") && scene.image.hasOwnProperty("right") && scene.image.hasOwnProperty("top") && scene.image.hasOwnProperty("bottom") && scene.image.hasOwnProperty("front") && scene.image.hasOwnProperty("back")) {
						scene._texturePreload = {
							right: null,
							left: null,
							top: null,
							bottom: null,
							front: null,
							back: null
						};
						scenes.push({scene: scene, imageType: 'right', imageUrl: scene.image.right});
						scenes.push({scene: scene, imageType: 'left', imageUrl: scene.image.left});
						scenes.push({scene: scene, imageType: 'top', imageUrl: scene.image.top});
						scenes.push({scene: scene, imageType: 'bottom', imageUrl: scene.image.bottom});
						scenes.push({scene: scene, imageType: 'front', imageUrl: scene.image.front});
						scenes.push({scene: scene, imageType: 'back', imageUrl: scene.image.back});
					}
				}
			}
			
			var data = {
				scenes: scenes,
				index: 0,
				callback: this.preloadScenesImages
			};
			
			this.preloadScenesImages(data);
		},
		
		preloadScenesImages: function(data) {
			if(data.scenes.length <= data.index)
				return;
			
			var image = new Image();
			image.onload = $.proxy(function ( xhr ) {
				var scene = data.scenes[data.index];
				if(scene.imageType == 'image') {
					if(scene.type == 'cube') {
						scene.scene._texture = this.createCubeTextures(image);
					} else {
						scene.scene._texture = {image:image};
					}
				} else { // it's a cubemap
					scene.scene._texturePreload[scene.imageType] = image;
					
					if(scene.scene._texturePreload.right &&
					   scene.scene._texturePreload.left &&
					   scene.scene._texturePreload.top &&
					   scene.scene._texturePreload.bottom &&
					   scene.scene._texturePreload.front &&
					   scene.scene._texturePreload.back) {
						scene.scene._texture = scene.scene._texturePreload;
						scene.scene._texturePreload = null;
					}
				}
				
				data.index++;
				data.callback.call(this, data);
			}, this);
			image.onerror = $.proxy(function ( xhr ) {
				data.index++;
				data.callback.call(this, data);
			}, this);
			image.src = data.scenes[data.index].imageUrl;
		},
		
		initAutoRotate: function() {
			if(this.config.autoRotate) {
				this.autoRotate.enabled = true;
			} else {
				this.autoRotate.enabled = false;
			}
			this.autoRotate.speed = this.config.autoRotateSpeed; // degrees per ms
			this.timeInteraction = Date.now() - this.config.autoRotateInactivityDelay;
		},
		
		create: function() {
			this.checkControls();
			this.checkAnimation();
			this.buildDOM();
			this.resetHandlers();

			if(this.util().webgl()) {
				this.applyHandlers();
				this.resetHotSpots();
				this.applyPopover();
				this.applyHotSpots();
				
				if (typeof this.config.onLoad == "function") { // make sure the callback is a function
					this.config.onLoad.call(this);
				}
				
				if(this.config.autoLoad) {
					this.controls.$loadBtn.hide(); // hide the load button
					this.loadScene(this.config.sceneId);
				}
				
				this.container.addClass("ipnrm-ready");
			} else {
				this.controls.$loadBtn.hide(); // hide the load button
				this.hideLoadInfo();
				this.controls.$info.html("<p>Your browser does not support WebGL</p>");
				this.controls.$info.fadeIn();
			}
		},
		
		checkControls: function() {
			if(this.sceneIdArray.length > 1) {
				return;
			}

			this.config.showSceneNextPrevCtrl = false;
		},
		
		checkAnimation: function() {
			var disabled = !this.config.mobile && this.util().isMobile(navigator.userAgent);
			if(this.util().animationEvent() == undefined || disabled) {
				this.config.popoverShowClass = null;
				this.config.popoverHideClass = null;
			}
		},
		
		loadScene: function(sceneId) {
			if(!sceneId) {
				return;
			}
			
			if (!this.config.scenes.hasOwnProperty(sceneId)) {
				this.showMessage("<p>Cannot load '" + sceneId + "' scene</p>");
				console.error("Cannot load '" + sceneId + "' scene");
				return;
			}
			
			if(this.loading && this.xhr && this.xhr.readyState != 4) {
				this.xhr.abort();
			}
			
			this.loading = true;
			this.showLoadInfo();
			this.controlHotSpots();
			
			// save yaw and pitch
			if(this.sceneId && (this.config.scenes[this.sceneId].saveCamera || this.sceneId==sceneId)) {
				var scene = this.config.scenes[this.sceneId];
				scene.pitch = this.pitch.value;
				scene.yaw = this.yaw.value;
				scene.zoom = this.zoom.value;
			}
			
			var scene = this.config.scenes[sceneId];
			this.pitch.value = scene.pitch;
			this.yaw.value = scene.yaw;
			this.zoom.value = Math.max(this.zoom.min, Math.min(this.zoom.max, scene.zoom));
			
			this.pitch.valueInit = scene._pitchInit;
			this.yaw.valueInit = scene._yawInit;
			this.zoom.valueInit = Math.max(this.zoom.min, Math.min(this.zoom.max, scene._zoomInit));
			
			var texture = {},
			count = 0,
			countLoaded = 0,
			capacity = {};
			
			function initScene(sceneId, texture) {
				this.hideLoadInfo();
				this.applyControls(sceneId);
				this.loading = false;
				
				this.resetTransition();
				
				var oldSceneId = this.sceneId,
				newSceneId = sceneId;
				
				this.buildScene( sceneId, texture );
				
				if (typeof this.config.onSceneChange == "function") { // make sure the callback is a function
					this.config.onSceneChange.call(this, oldSceneId, newSceneId);
				}
				
				this.animateStart();
			}
			
			if(scene._texture) {
				initScene.call(this, sceneId, scene._texture);
				return;
			}
			
			if (typeof scene.image === "string") {
				texture.image = scene.image;
			} else if(scene.image.hasOwnProperty("left") && scene.image.hasOwnProperty("right") && scene.image.hasOwnProperty("top") && scene.image.hasOwnProperty("bottom") && scene.image.hasOwnProperty("front") && scene.image.hasOwnProperty("back")) {
				texture.right = scene.image.right;
				texture.left = scene.image.left;
				texture.top = scene.image.top;
				texture.bottom = scene.image.bottom;
				texture.front = scene.image.front;
				texture.back = scene.image.back;
			} else {
				this.controls.$loadInfo.fadeTo("slow",0);
				this.showMessage("<p>Wrong parameter value for texture</p>");
				console.error("Wrong parameter value for texture");
			}
			
			for (var key in texture) {
				if (texture.hasOwnProperty(key)) {
					count++;
				}
			}
			
			
			for (var key in texture) {
				if (texture.hasOwnProperty(key)) {
					this.xhr = new XMLHttpRequest();
					var xhr = this.xhr;
					xhr.open("GET", texture[key], true)
					xhr.crossOrigin = "Anonymous";
					xhr.responseType = "arraybuffer";
					xhr.customKey = key;
					xhr.onprogress = $.proxy(function ( e ) {
						var target = e.currentTarget;
						if (e.lengthComputable) {
							capacity[target.customKey] = {total: e.total, loaded: e.loaded};
							
							var total, loaded;
							for (var key in capacity) {
								if (capacity.hasOwnProperty(key)) {
									total = capacity[key].total;
									loaded = capacity[key].loaded;
								}
							}
							
							var percent = Math.floor(loaded / total * 100) + "%";
							this.controls.$loadProgressBar.stop().animate({width: percent});
						}
					}, this);
					xhr.onload = $.proxy(function( e ) {
						var target = e.currentTarget;
						if (target.status >= 400) {
							return target.onerror( e );
						}
						
						var blob = new Blob([target.response]);
						var image = new Image();
						image.onload = $.proxy(function ( xhr ) {
							texture[xhr.customKey] = image;
							if(++countLoaded == count) {
								var scene = this.config.scenes[sceneId];
								
								if(scene.type == 'cube' && count == 1) {
									texture = this.createCubeTextures(image);
								}
								scene._texture = texture;
								
								initScene.call(this, sceneId, texture);
							}
						}, this, target);
						image.onerror = $.proxy(function ( xhr ) {
							if(++countLoaded == count) {
								this.hideLoadInfo();
								this.showMessage("<p>Cannot load texture</p>");
								console.error("Cannot load texture '" + texture[xhr.customKey] + "'");
							}
						}, this, target);
						image.src = window.URL.createObjectURL(blob);
					}, this);
					xhr.onerror = $.proxy(function( e ) {
						var target = e.currentTarget;
						this.hideLoadInfo();
						this.showMessage("<p>Cannot load texture</p>");
						console.error("Cannot load texture '" + texture[target.customKey] + "'");
					}, this);
					xhr.send();
				}
			}
		},
		
		loadHotSpots: function(sceneId, hotSpots) {
			if (!this.config.scenes.hasOwnProperty(sceneId)) {
				console.error("Cannot load hotspots for the '" + sceneId + "' scene");
				return;
			}
			
			var scene = this.config.scenes[sceneId];
			scene.hotSpots = hotSpots;
			
			this.resetHotSpots();
			this.applyHotSpots();
			
			if(!this.loading) {
				this.controlHotSpots();
			}
		},
		
		applyHotSpots: function() {
			for (var key in this.config.scenes) {
				if (this.config.scenes.hasOwnProperty(key)) {
					var scene = this.config.scenes[key];
					
					var hotSpots = JSON.parse(JSON.stringify(scene.hotSpots)); // clone object without reference
					for (var i = 0, len = hotSpots.length; i < len; i++) {
						var hotSpot = hotSpots[i];
						hotSpot.yaw = (hotSpot.yaw ? hotSpot.yaw : 0);
						hotSpot.pitch = (hotSpot.pitch ? hotSpot.pitch : 0);
						hotSpot.sceneOwnerId = key;
						hotSpot.xyz = this.getPitchYawPoint(hotSpot.pitch, hotSpot.yaw);
						hotSpot.visible = false;
						
						if(hotSpot.className) {
							hotSpot.$el = $("<div class='ipnrm-hotspot-custom " + hotSpot.className + "' style='display:none;'></div>");
						} else if(hotSpot.imageUrl) {
							hotSpot.$el = $("<div class='ipnrm-hotspot-custom' style='display:none;'></div>");
						} else {
							hotSpot.$el = $("<div class='ipnrm-hotspot' style='display:none;'></div>");
						}
						
						if(hotSpot.imageUrl) {
							var style = "style='";
							if(hotSpot.imageWidth || hotSpot.imageHeight) {
								style = style + (hotSpot.imageWidth ? "width:" + hotSpot.imageWidth + "px;" : "") + (hotSpot.imageHeight ? "height:" + hotSpot.imageHeight + "px;" : "");
							}
							style = style + "'";
							
							var $data = $("<div class='ipnrm-hotspot-image'></div>");
							hotSpot.$image = $("<img src='" + hotSpot.imageUrl + "' alt=''" + style + ">");
							hotSpot.$el.append($data.append(hotSpot.$image));
						}
						
						if(hotSpot.link) {
							var $data = $("<div class='ipnrm-hotspot-link'></div>").append("<a href='" + hotSpot.link + "' target='" + (hotSpot.linkNewWindow ? "_blank" : "_self") + "' rel='nofollow'>");
							hotSpot.$el.append($data);
						}
						
						if(hotSpot.content) {
							var $data = $("<div class='ipnrm-hotspot-data'></div>").append(hotSpot.content);
							hotSpot.$el.append($data);
						}
						
						if(!(typeof hotSpot.popoverLazyload === "boolean")) {
							hotSpot.popoverLazyload = true;
						}
						
						if(!(typeof hotSpot.popoverShow === "boolean")) {
							hotSpot.popoverShow = false;
						}
						
						if(!(typeof hotSpot.popoverSelectorDetach === "boolean")) {
							hotSpot.popoverSelectorDetach = false;
						}
						
						hotSpot.$popover = null;
						
						if(typeof hotSpot.sceneId === "string") {
							hotSpot.$el.addClass("ipnrm-hotspot-scene");
							hotSpot.$el.on("click.ipanorama touchstart.ipanorama", $.proxy(this.onHotSpotSceneClick, this, hotSpot) );
						}
						
						// restore the reference if 'popoverContent' is a function
						if(typeof scene.hotSpots[i].popoverContent == "function") {
							hotSpot.popoverContent = scene.hotSpots[i].popoverContent;
						}
						
						// handle short touch events and <a> tag
						hotSpot.$el.on("touchend.ipanorama", $.proxy(this.onHotSpotTouchEnd, this, hotSpot) );
						
						if(hotSpot.popoverContent || hotSpot.popoverSelector) {
							var triggers = this.config.popoverShowTrigger.split(' ');
							for (var j = triggers.length; j--;) {
								var trigger = triggers[j];
								
								if (trigger == "click") {
									hotSpot.$el.on("click.ipanorama", $.proxy(this.onHotSpotClick, this, hotSpot) );
									hotSpot.$el.on("touchstart.ipanorama", $.proxy(this.onHotSpotClick, this, hotSpot) );
								} else if (trigger == "hover") {
									hotSpot.$el.on("mouseenter.ipanorama", $.proxy(this.onHotSpotEnter, this, hotSpot) );
									hotSpot.$el.on("touchstart.ipanorama", $.proxy(this.onHotSpotClick, this, hotSpot) );
								}
							}
							
							var triggers = this.config.popoverHideTrigger.split(' ');
							for (var j = triggers.length; j--;) {
								var trigger = triggers[j];
								
								if (trigger == "click") {
									hotSpot.$el.on("click.ipanorama", $.proxy(this.onPopoverHide, this, hotSpot) );
									hotSpot.$el.on("touchstart.ipanorama", $.proxy(this.onPopoverHide, this, hotSpot) );
								} else if (trigger == "grab") {
									$("body").add(this.controls.$view).on("mousedown.ipanorama touchstart.ipanorama", $.proxy(this.onPopoverHide, this, hotSpot) );
								} else if (trigger == "leave") {
									hotSpot.$el.on("mouseleave.ipanorama", $.proxy(this.onHotSpotLeave, this, hotSpot) );
									$("body").add(this.controls.$view).on("touchstart.ipanorama", $.proxy(this.onPopoverHide, this, hotSpot) );
								} else if (trigger == "manual") {
									this.popoverCloseManual = true;
								}
							}
						}
						
						this.controls.$hotspots.append(hotSpot.$el);
						
						if(this.popover && (!hotSpot.popoverLazyload || hotSpot.popoverShow)) {
							this.createPopover(hotSpot);
							
							if(hotSpot.popoverShow) {
								hotSpot.$popover.addClass("ipnrm-active");
							}
						}
					}
					
					this.hotSpots = this.hotSpots.concat(hotSpots);
				}
			}
		},
		
		resetHotSpots: function() {
			this.controls.$hotspots.children().fadeTo("slow", 0, function() {
				$(this).remove()
			});
		},
		
		applyPopover: function() {
			this.popover = this.config.popover;
			if(!this.popover) {
				return;
			}
			
			var template = $(this.config.popoverTemplate);
			if (template.length != 1) {
				this.popover = false;
				console.error("'popoverTemplate' option must consist of exactly 1 top-level element!");
				return;
			}
			this.popoverTemplate = this.config.popoverTemplate;
		},
		
		createPopover: function(hotSpot) {
			// popover doesn't exist, let's create it
			if(!hotSpot.$popover) {
				hotSpot.$popover = $(this.popoverTemplate);
				
				var popoverId = this.getPopoverUID("popover");
				hotSpot.$popover.attr("id", popoverId);
				
				if(this.popoverCloseManual) {
					hotSpot.$popover.addClass("ipnrm-close");
					hotSpot.$popover.find(".ipnrm-close").on("click.ipanorama", $.proxy(this.onPopoverHide, this, hotSpot) );
				}
				
				hotSpot.$popover.on("click.ipanorama", $.proxy(this.onPopoverClick, this, hotSpot) )
			}
			
			var $popover = hotSpot.$popover;
			if(!$popover.hasClass("ipnrm-active") || hotSpot.$popover.hasClass(this.config.popoverHideClass) ) {
				var content = this.getPopoverContent(hotSpot);
				
				$popover.find(".ipnrm-content").children().detach().end()[ // maintain js events
					(hotSpot.popoverHtml ? (typeof content == "string" ? "html" : "append") : "text")
				](content);
				
				$popover.detach().css({ top: -9999, left: -9999, width: ""});
				$popover.removeClass(this.config.popoverHideClass);
				$popover.removeClass(this.config.popoverShowClass);
				
				if(hotSpot.popoverWidth) {
					$popover.css({"max-width": hotSpot.popoverWidth, "min-width": hotSpot.popoverWidth});
				}
				
				this.liftupPopover(hotSpot);
				
				$popover.appendTo(this.controls.$panorama);
				if($popover[0].offsetWidth > 0) {
					$popover.css({width: $popover[0].offsetWidth});
				}
				
				// apply refresh timer
				this.resetHotSpotTimer();
				this.hotSpotTimerDelay = 600;
				this.hotSpotTimerId = setTimeout($.proxy(this.onHotSpotTimer, this), this.hotSpotTimerDelay);
			}
		},
		
		showPopover: function(hotSpot) {
			if(!this.popover || !hotSpot.visible || (!hotSpot.popoverContent && !hotSpot.popoverSelector)) {
				return;
			}
			
			this.createPopover(hotSpot);
			
			// place the popover on the panorama view
			var placement = this.config.popoverPlacement;
			if(hotSpot.popoverPlacement) {
				placement = hotSpot.popoverPlacement;
			}
			
			var pos = this.getPopoverPosition(hotSpot),
			$popover = hotSpot.$popover,
			popoverWidth  = $popover[0].offsetWidth,
			popoverHeight = $popover[0].offsetHeight;
			
			
			//placement = placement == "bottom" && (pos.bottom + popoverHeight) > (window.pageYOffset + window.innerHeight) ? "top"    :
			//			placement == "top"    && (pos.top    - popoverHeight) < (window.pageYOffset)                      ? "bottom" :
			//			placement == "right"  && (pos.right  + popoverWidth)  > (window.pageXOffset + window.innerWidth)  ? "left"   :
			//			placement == "left"   && (pos.left   - popoverWidth)  < (window.pageXOffset)                      ? "right"  :
			//			placement;
			
			var offset = this.getPopoverOffset(placement, pos, popoverWidth, popoverHeight);
			this.applyPopoverPlacement(hotSpot, offset, placement);
			
			
			// make the popover active
			if(!$popover.hasClass("ipnrm-active")) {
				$popover.removeClass(this.config.popoverHideClass);
				$popover.addClass(this.config.popoverShowClass);
				
				if( this.config.popoverShowClass ) {
					hotSpot.$popover.css("visibility", "visible"); // little hack to prevent incorrect position of the popover
					hotSpot.$popover.addClass("ipnrm-active").addClass(this.config.popoverShowClass);
					
					hotSpot.$popover.one(this.util().animationEvent(), $.proxy(function(e) {
						var $popover = $(e.target);
						if(!$popover.hasClass(this.config.popoverHideClass)) {
							$popover.removeClass(this.config.popoverShowClass);
						}
						$popover.css("visibility", "");
					}, this) );
				} else {
					$popover.addClass("ipnrm-active");
				}
			}
		},
		
		hidePopover: function(hotSpot) {
			if( hotSpot.$popover && (hotSpot.$popover.hasClass("ipnrm-active") || hotSpot.$popover.hasClass(this.config.popoverShowClass)) ) {
				hotSpot.$popover.removeClass(this.config.popoverShowClass);
				
				hotSpot.$popover.css("z-index", "");
				hotSpot.$el.css("z-index", "");
				
				if( this.config.popoverHideClass ) {
					hotSpot.$popover.addClass(this.config.popoverHideClass);
					
					hotSpot.$popover.one(this.util().animationEvent(), $.proxy(function(e) {
						var $popover = $(e.target);
						if(!$popover.hasClass(this.config.popoverShowClass)) {
								$popover.removeClass(this.config.popoverHideClass);
								this.retachPopover(hotSpot.$popover);
							}
					}, this) );
				} else {
					this.retachPopover(hotSpot.$popover);
				}
			}
		},
		
		retachPopover: function($popover) {
			$popover.removeClass("ipnrm-active");
			$popover.detach(); // little hack to force close all media queries
			$popover.get(0).offsetHeight;
			$popover.css({ top: -9999, left: -9999, width: ""});
			
			$popover.appendTo(this.controls.$view);
			
			if(this.controls.$panorama.find(".ipnrm-popover.ipnrm-active").length == 0) {
				this.controls.$panorama.find(".ipnrm-hotspot, .ipnrm-popover").css("z-index", "");
				this.zindex = 4;
			}
		},
		
		liftupPopover: function(hotSpot) {
			if(this.hotSpots.length > 1 || hotSpot.popoverShow) {
				if(this.config.hotSpotBelowPopover) {
					hotSpot.$el.css("z-index", this.zindex+1);
					hotSpot.$popover.css("z-index", this.zindex+2);
				} else {
					hotSpot.$el.css("z-index", this.zindex+2);
					hotSpot.$popover.css("z-index", this.zindex+1);
				}
				this.zindex = this.zindex+2;
			}
		},
		
		resetHotSpotTimer: function() {
			if(this.hotSpotTimerId) {
				clearTimeout(this.hotSpotTimerId);
			}
		},
		
		onHotSpotTimer: function() {
			var flag = false;
			this.hotSpotTimerDelay += 200;
			for (var i = this.hotSpots.length; i--;) {
				var hotSpot = this.hotSpots[i];
				if(hotSpot.$popover && hotSpot.$popover.hasClass("ipnrm-active") && !hotSpot.$popover.hasClass(this.config.popoverHideClass))
				{
					flag = true;
					if(!hotSpot.$popover.hasClass(this.config.popoverShowClass)) {
						this.showPopover(hotSpot);
					}
				}
			}
			
			if(this.hotSpotTimerDelay > 1800) {
				flag = false;
			}
			
			if(flag) {
				this.hotSpotTimerId = setTimeout($.proxy(this.onHotSpotTimer, this), this.hotSpotTimerDelay);
			} else {
				this.hotSpotTimerId = null;
			}
		},
		
		getPopoverContent: function (hotSpot) {
			if(hotSpot.popoverContent) {
				return (typeof hotSpot.popoverContent == "function" ? hotSpot.popoverContent.call(hotSpot) : hotSpot.popoverContent);
			} else if(hotSpot.popoverSelector) {
				if(hotSpot.popoverSelectorDetach) {
					return $(hotSpot.popoverSelector).detach();
				}
				return $(hotSpot.popoverSelector).html();
			}
			return "";
		},
		
		getPopoverPosition: function (hotSpot) {
			var $el = hotSpot.$el,
			el = $el.get(0);
			
			var rect = el.getBoundingClientRect(),
			offset = $el.offset();
			
			var result = $.extend({}, rect, offset);
			result.top  = result.top  + result.height/2;
			result.left = result.left + result.width/2;
			
			return result;
		},
		
		//getPopoverOffset: function(placement, pos, popoverWidth, popoverHeight) {
		//	return placement == "bottom" ? { top: pos.top + pos.height,    left: pos.left + pos.width / 2 - popoverWidth / 2 }  :
		//		   placement == "top"    ? { top: pos.top - popoverHeight, left: pos.left + pos.width / 2 - popoverWidth / 2 }  :
		//		   placement == "left"   ? { top: pos.top + pos.height / 2 - popoverHeight / 2, left: pos.left - popoverWidth } :
		//		/* placement == "right" */ { top: pos.top + pos.height / 2 - popoverHeight / 2, left: pos.left + pos.width }
		//},
		
		getPopoverOffset: function(placement, pos, popoverWidth, popoverHeight) {
			return placement == "bottom"       ? { top: pos.top,                     left: pos.left - popoverWidth / 2 } :
				   placement == "top"          ? { top: pos.top - popoverHeight,     left: pos.left - popoverWidth / 2 } :
				   placement == "left"         ? { top: pos.top - popoverHeight / 2, left: pos.left - popoverWidth } :
				   placement == "right"        ? { top: pos.top - popoverHeight / 2, left: pos.left } :
				   placement == "bottom-left"  ? { top: pos.top,                     left: pos.left - popoverWidth } :
				   placement == "bottom-right" ? { top: pos.top,                     left: pos.left } :
				   placement == "top-left"     ? { top: pos.top - popoverHeight,     left: pos.left - popoverWidth} :
				   placement == "top-right"    ? { top: pos.top - popoverHeight,     left: pos.left } : 
				/* placement == "top" */         { top: pos.top - popoverHeight,     left: pos.left - popoverWidth / 2 };
		},
		
		applyPopoverPlacement: function (hotSpot, offset, placement) {
			var $popover = hotSpot.$popover,
			popoverWidth  = $popover[0].offsetWidth,
			popoverHeight = $popover[0].offsetHeight;
			
			// manually read margins because getBoundingClientRect includes difference
			var marginTop = parseInt($popover.css("margin-top"), 10),
			marginLeft = parseInt($popover.css("margin-left"), 10),
			marginBottom = parseInt($popover.css("margin-bottom"), 10),
			marginRight = parseInt($popover.css("margin-right"), 10);

			// we must check for NaN for ie 8/9
			if (isNaN(marginTop))    marginTop  = 0;
			if (isNaN(marginLeft))   marginLeft = 0;
			if (isNaN(marginBottom)) marginBottom = 0;
			if (isNaN(marginRight))  marginRight = 0;

			offset.top  += (marginTop  - marginBottom);
			offset.left += (marginLeft - marginRight);
			
			// $.fn.offset doesn't round pixel values
			// so we use setOffset directly with our own function B-0
			$.offset.setOffset($popover[0], $.extend({
				using: function (props) {
					$popover.css({
						top: Math.round(props.top),
						left: Math.round(props.left)
					})
				}
			}, offset), 0);
			
			
			var classes = ["top", "left", "bottom", "right", "top-left", "top-right", "bottom-left", "bottom-right"];
			for(var i = classes.length; i--;) {
				if(classes[i] == placement) {
					classes.splice(i, 1);
					break;
				}
			}
			for(var i = classes.length; i--;) {
				$popover.removeClass("ipnrm-popover-" + classes[i]);
			}
			
		  
			$popover.addClass("ipnrm-popover-" + placement);
		},
		
		getPopoverUID: function(prefix) {
			do prefix += ~~(Math.random() * 1000000);
			while (document.getElementById(prefix));
			return prefix;
		},
		
		buildDOM: function() {
			this.container.empty();
			
			this.controls.$panorama = $("<div class='ipnrm" + (this.config.theme ? " " + this.config.theme : "") + (this.config.showControlsOnHover ? " ipnrm-hide-controls" : "") + "' tabindex='1'></div>");
			this.controls.$view = $("<div class='ipnrm-view'></div>");
			this.controls.$preview = $("<div class='ipnrm-preview'></div>");
			if(this.config.imagePreview) {
				this.controls.$preview.css("background-image", "url(" + this.config.imagePreview + ")");
			}
			this.controls.$scene = $("<div class='ipnrm-scene'></div>");
			this.controls.$hotspots = $("<div class='ipnrm-hotspots'></div>");
			this.setViewCursorShape("ipnrm-grab");
			this.controls.$view.append(this.controls.$preview);
			this.controls.$view.append(this.controls.$scene);
			this.controls.$view.append(this.controls.$hotspots);
			
			// controls
			this.controls.$loadBtn = $("<div class='ipnrm-btn-load'><p>click to<br>load<br>panorama</p></div>");
			this.controls.$loadInfo = $("<div class='ipnrm-load-info' style='display:none'></div>");
			this.controls.$loadInfoInner = $("<div class='ipnrm-load-info-inner'><p>Loading</p></div>");
			this.controls.$loadProgress = $("<div class='ipnrm-load-progress'></div>");
			this.controls.$loadProgressBar = $("<div class='ipnrm-load-progress-bar'></div>");
			this.controls.$loadProgress.append(this.controls.$loadProgressBar);
			this.controls.$loadInfoInner.append(this.controls.$loadProgress);
			this.controls.$loadInfo.append(this.controls.$loadInfoInner);
			this.controls.$info = $("<div class='ipnrm-info' style='display:none'></div>");
			this.controls.$controls = $("<div class='ipnrm-controls'></div>");
			this.controls.$sceneThumbs = $("<div class='ipnrm-scene-thumbs'></div>");
			this.controls.$sceneThumbsInner = $("<div class='ipnrm-scene-thumbs-inner'></div>");
			this.controls.$toolbar = $("<div class='ipnrm-toolbar' style='display:none'></div>");
			this.controls.$sceneMenu = $("<div class='ipnrm-btn-scene-menu ipnrm-btn' style='display:none'></div>");
			this.controls.$scenePrev = $("<div class='ipnrm-btn-scene-prev ipnrm-btn' style='display:none'></div>");
			this.controls.$sceneNext = $("<div class='ipnrm-btn-scene-next ipnrm-btn' style='display:none'></div>");
			this.controls.$zoomIn = $("<div class='ipnrm-btn-zoom-in ipnrm-btn' style='display:none'></div>");
			this.controls.$zoomOut = $("<div class='ipnrm-btn-zoom-out ipnrm-btn' style='display:none'></div>");
			this.controls.$share = $("<div class='ipnrm-btn-share ipnrm-btn' style='display:none'></div>");
			this.controls.$fullscreen = $("<div class='ipnrm-btn-fullscreen ipnrm-btn' style='display:none'></div>");
			this.controls.$autorotate = $("<div class='ipnrm-btn-autorotate ipnrm-btn' style='display:none'></div>");
			this.controls.$autorotate.addClass((this.config.autoRotate ? 'ipnrm-active' : ''));
			this.controls.$compass = $("<div class='ipnrm-compass' style='display:none'></div>");
			this.controls.$title = $("<div class='ipnrm-title' style='display:none'></div>");

			// add scene thumbs
			if(this.config.showSceneThumbsCtrl || this.config.showSceneMenuCtrl) {
				for (var sceneId in this.config.scenes) {
					if (this.config.scenes.hasOwnProperty(sceneId)) {
						var scene = this.config.scenes[sceneId];
						if(scene.thumb) {
							var $sceneThumb = $("<div class='ipnrm-scene-thumb'></div>");
							$sceneThumb.attr("data-sceneid", sceneId);
							
							if(scene.thumbImage) {
								$sceneThumb.append("<img class='ipnrm-scene-thumb-img' src='" + scene.thumbImage + "' alt=''>")
							}
							
							this.controls.$sceneThumbsInner.append($sceneThumb);
						}
					}
				}
				this.controls.$sceneThumbs.append(this.controls.$sceneThumbsInner);
			}
			
			this.controls.$controls.append(
				this.controls.$sceneThumbs,
				this.controls.$toolbar,
				this.controls.$sceneMenu,
				this.controls.$scenePrev,
				this.controls.$sceneNext,
				this.controls.$zoomIn,
				this.controls.$zoomOut,
				this.controls.$share,
				this.controls.$fullscreen,
				this.controls.$autorotate,
				this.controls.$compass,
				this.controls.$title
			);

			this.container.append(this.controls.$panorama);
			this.controls.$panorama.append(
				this.controls.$view,
				this.controls.$loadBtn,
				this.controls.$loadInfo,
				this.controls.$info,
				this.controls.$controls
			);
		},
		
		buildScene: function( sceneId, texture ) {
			var w = this.controls.$view.width(),
			h = this.controls.$view.height();
			
			if(w == 0 && h ==0) {
				var $sizeEl = $(this.config.containerSizeSelector);
				
				w = $sizeEl.width();
				h = $sizeEl.height();
			}
			
			this.sceneId = sceneId;
			this.aspect = w/h;
			this.scene = new THREE.Scene();
			this.camera = new THREE.PerspectiveCamera(this.zoom.value, this.aspect, this.cameraNearClipPlane, this.cameraFarClipPlane);
			
			
			// Fix IE bug with memory leak
			if(this.material) {
				function releaseMaterial(material) {
					if(material.map) {
						material.map.dispose();
						material.map = null;
					}
					material.dispose();
				}
				
				if(this.material.type == "MultiMaterial") {
					for(var i=0; i<this.material.materials.length;i++) {
						releaseMaterial(this.material.materials[i]);
					}
				} else {
					releaseMaterial(this.material);
				}
				this.material = null;
			}
			
			
			this.buildGeomentry( sceneId, texture );
			
			// setting up the renderer
			if(this.renderer) {
				this.renderer.dispose();
				this.renderer = null;
			}
			this.renderer = new THREE.WebGLRenderer({antialias: false});
			this.renderer.setClearColor(0x000000, 0);
			this.renderer.setSize( w, h );
			// Round down fractional DPR values for better performance.
			this.renderer.setPixelRatio(Math.floor(window.devicePixelRatio));
			
			var $el = $(this.renderer.domElement);
			$el.fadeTo(0,0);
			this.controls.$scene.append( $el );
			$el.fadeTo(this.config.sceneFadeDuration, 1, $.proxy(function() {
				if(this.controls.$scene.children().length > 1) {
					this.controls.$scene.children(":first-child").remove();
				}
			}, this));
		},
		
		buildGeomentry: function( sceneId, texture ) {
			var scene = this.config.scenes[sceneId];
			
			if(scene.type == "cube") { 
				this.buildCube( texture ); 
			} else if (scene.type == "sphere") { 
				this.buildSphere( texture, scene );
			} else if (scene.type == "cylinder") { 
				this.buildCylinder( texture ); 
			}
		},
		
		buildCube: function( texture ) {
			var geometry = new THREE.BoxGeometry( 100, 100, 100 );
			geometry.scale(-1,1,1);
			
			//var material = null;
			
			if(texture.hasOwnProperty("image")) {
				this.material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
				this.material.map = this.createTexture(texture, "image");
				
				var front = [new THREE.Vector2(0, 1), new THREE.Vector2(0, 0), new THREE.Vector2(.166, 0), new THREE.Vector2(.166, 1)],
				right = [new THREE.Vector2(.166, 1), new THREE.Vector2(.166, 0), new THREE.Vector2(.333, 0), new THREE.Vector2(.333, 1)],
				back = [new THREE.Vector2(.333, 1), new THREE.Vector2(.333, 0), new THREE.Vector2(.5, 0), new THREE.Vector2(.5, 1)],
				left = [new THREE.Vector2(.5, 1), new THREE.Vector2(.5, 0), new THREE.Vector2(.666, 0), new THREE.Vector2(.666, 1)],
				top = [new THREE.Vector2(.833, 1), new THREE.Vector2(.666, 1), new THREE.Vector2(.666, 0), new THREE.Vector2(.833, 0)],
				bottom = [new THREE.Vector2(.833, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1), new THREE.Vector2(.833, 1)];
				
				geometry.faceVertexUvs[0] = [];
				
				geometry.faceVertexUvs[0][0] = [ right[0], right[1], right[3] ];
				geometry.faceVertexUvs[0][1] = [ right[1], right[2], right[3] ];
				
				geometry.faceVertexUvs[0][2] = [ left[0], left[1], left[3] ];
				geometry.faceVertexUvs[0][3] = [ left[1], left[2], left[3] ];
				
				geometry.faceVertexUvs[0][4] = [ top[0], top[1], top[3] ];
				geometry.faceVertexUvs[0][5] = [ top[1], top[2], top[3] ];
				
				geometry.faceVertexUvs[0][8] = [ front[0], front[1], front[3] ];
				geometry.faceVertexUvs[0][9] = [ front[1], front[2], front[3] ];
				
				geometry.faceVertexUvs[0][6] = [ bottom[0], bottom[1], bottom[3] ];
				geometry.faceVertexUvs[0][7] = [ bottom[1], bottom[2], bottom[3] ];
				
				geometry.faceVertexUvs[0][10] = [ back[0], back[1], back[3] ];
				geometry.faceVertexUvs[0][11] = [ back[1], back[2], back[3] ];
			} else {
				var materials = [];
				materials.push(new THREE.MeshBasicMaterial({map: this.createTexture(texture, "right"), side: THREE.FrontSide }));
				materials.push(new THREE.MeshBasicMaterial({map: this.createTexture(texture, "left"), side: THREE.FrontSide }));
				materials.push(new THREE.MeshBasicMaterial({map: this.createTexture(texture, "top"), side: THREE.FrontSide }));
				materials.push(new THREE.MeshBasicMaterial({map: this.createTexture(texture, "bottom"), side: THREE.FrontSide }));
				materials.push(new THREE.MeshBasicMaterial({map: this.createTexture(texture, "front"), side: THREE.FrontSide }));
				materials.push(new THREE.MeshBasicMaterial({map: this.createTexture(texture, "back"), side: THREE.FrontSide }));
				
				this.material = new THREE.MeshFaceMaterial(materials) ;
			}
			
			var mesh = new THREE.Mesh(geometry, this.material);
			this.scene.add(mesh);
		},
		
		buildSphere: function( texture, scene ) {
			var geometry = new THREE.SphereGeometry(100, scene.sphereWidthSegments, scene.sphereHeightSegments);
			geometry.scale(-1,1,1);
			
			this.material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
			if(texture.hasOwnProperty("image")) {
				this.material.map = this.createTexture(texture, "image");
			}
			
			var mesh = new THREE.Mesh(geometry, this.material);
			this.scene.add(mesh);
		},
		
		buildCylinder: function( texture ) {
			var ratio = null,
			geometry = null;
			
			if(texture.hasOwnProperty("image")) {
				ratio = texture.image.width / texture.image.height;
				
				var h = 2 * Math.PI * 100 / ratio;
				geometry = new THREE.CylinderGeometry(100, 100, h, 40, 1, true);
			} else {
				geometry = new THREE.CylinderGeometry(100, 100, 200, 40, 1, true);
			}
			
			geometry.scale(-1,1,1);
			
			this.material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
			if(texture.hasOwnProperty("image")) {
				this.material.map = this.createTexture(texture, "image");
			}
			
			var mesh = new THREE.Mesh(geometry, this.material);
			this.scene.add(mesh);
		},
		
		animateStart: function() {
			if (typeof performance !== "undefined" && performance.now()) {
				this.timePrev = performance.now();
			} else {
				this.timePrev = Date.now();
			}
			
			if (this.animating || this.loading) {
				return;
			}
			
			this.animating = true;
			this.animate();
		},
		
		animate: function() {
			if (this.loading) {
				this.animating = false;
				return;
			}
			
			this.renderScene();
			this.controlHotSpots();
			this.controlCompass();
			
			if(this.grabControl.enabled) {
				this.controlHoverGrabControl();
				this.animationId = requestAnimationFrame( $.proxy(this.animate, this) );
			} else if (this.isTransition() || this.hoverGrabControl.enabled) {
				this.applyTransition();
				this.controlHoverGrabControl();
				this.animationId = requestAnimationFrame( $.proxy(this.animate, this) );
			} else {
				this.animating = false;
			}
		},
		
		controlYawPitchLimits: function() {
			var scene = this.config.scenes[this.sceneId];
			
			if(scene.yawLimits) {
				var yawDelta = this.yaw.valueInit - this.yaw.value;
				
				if(yawDelta < 0 && Math.abs(yawDelta) > scene.yawLimitLeft) {
					this.yaw.value = this.yaw.valueInit + scene.yawLimitLeft;
				} else if(yawDelta > 0 && Math.abs(yawDelta) > scene.yawLimitRight) {
					this.yaw.value = this.yaw.valueInit - scene.yawLimitRight;
				}
			}
			
			if(scene.pitchLimits) {
				var pitchDelta = this.pitch.valueInit - this.pitch.value;
				
				if(pitchDelta > 0 && Math.abs(pitchDelta) > scene.pitchLimitUp) {
					this.pitch.value = this.pitch.valueInit - scene.pitchLimitUp;
				} else if(pitchDelta < 0 && Math.abs(pitchDelta) > scene.pitchLimitDown) {
					this.pitch.value = this.pitch.valueInit + scene.pitchLimitDown;
				}
			}
		},
		
		isTransition: function() {
			if((this.autoRotate.enabled) || (this.yaw.time < this.yaw.duration) || (this.pitch.time < this.pitch.duration) || (this.zoom.time < this.zoom.duration)) {
				return true;
			}
			return false;
		},
		
		applyTransition: function() {
			if (typeof performance !== "undefined" && performance.now()) {
				this.timeNext = performance.now();
			} else {
				this.timeNext = Date.now();
			}
			if (this.timePrev === undefined) {
				this.timePrev = this.timeNext;
			}
			var timeDelta = (this.timeNext - this.timePrev);
			
			// if auto-rotate
			var timeInactivity = Date.now() - this.timeInteraction;
			if(this.autoRotate.enabled && timeInactivity > this.config.autoRotateInactivityDelay) {
				this.yaw.value -= this.autoRotate.speed * timeDelta;
			}
			
			this.applyInterpolation(this.yaw, timeDelta);
			this.applyInterpolation(this.pitch, timeDelta);
			this.applyInterpolation(this.zoom, timeDelta);
			
			this.controlYawPitchLimits();
			this.zoom.value = Math.max(this.zoom.min, Math.min(this.zoom.max, this.zoom.value));
			
			this.timePrev = this.timeNext;
		},
		
		resetTransition: function() {
			this.yaw.time = this.yaw.duration;
			this.pitch.time = this.pitch.duration;
			this.zoom.time = this.zoom.duration;
		},
		
		resetScene: function() {
			if(this.animationId) {
				cancelAnimationFrame(this.animationId); // stop the animation
			}
			this.renderer = null;
			this.scene = null;
			this.camera = null;
			this.container.empty();
		},
		
		renderScene: function() {
			if(this.camera.fov != this.zoom.value) {
				this.camera.fov = this.zoom.value;
				this.camera.updateProjectionMatrix();
			}
			
			this.camera.lookAt(this.getPitchYawPoint(this.pitch.value, this.yaw.value));
			
			var size = this.renderer.getSize();
			this.renderer.clear();
			this.renderer.setViewport( 0, 0, size.width, size.height );
			this.renderer.render( this.scene, this.camera );
			
			if (typeof this.config.onCameraUpdate == "function") { // make sure the callback is a function
				this.config.onCameraUpdate.call(this, this.yaw.value, this.pitch.value, this.zoom.value); // brings the scope to the callback
			}
		},
		
		controlCompass: function() {
			if(this.config.compass && this.sceneId && this.config.scenes[this.sceneId].compassNorthOffset != null) {
				var compassNorthOffset = this.config.scenes[this.sceneId].compassNorthOffset;
				
				var deg = compassNorthOffset - this.yaw.value;
				this.controls.$compass.css({"transform": "rotate(" + deg + "deg)"});
			}
		},
		
		controlHotSpots: function() {
			if(this.camera == null) {
				return;
			}
			
			// check if hotSpot point is in the camera view
			var w = this.controls.$view.width(),
			h = this.controls.$view.height();
			
			if(w == 0 && h ==0) {
				var $sizeEl = $(this.config.containerSizeSelector);
				
				w = $sizeEl.width();
				h = $sizeEl.height();
			}
			
			var frustum = new THREE.Frustum;
			frustum.setFromMatrix( new THREE.Matrix4().multiplyMatrices( this.camera.projectionMatrix, this.camera.matrixWorldInverse ) );
			
			// needs improvement
			for(var i = this.hotSpots.length; i--;){
				var hotSpot = this.hotSpots[i];
				if(!this.loading && frustum.containsPoint( hotSpot.xyz ) && hotSpot.sceneOwnerId == this.sceneId) {
					if(hotSpot.visible) {
						this.updateHotSpots(this.camera, w, h, hotSpot);
					} else {
						hotSpot.visible = true;
						hotSpot.$el.fadeIn();
						if(hotSpot.$popover) {
							hotSpot.$popover.removeClass("ipnrm-hidden");
						}
						this.updateHotSpots(this.camera, w, h, hotSpot);
					}
				} else {
					if(hotSpot.visible) {
						hotSpot.visible = false;
						hotSpot.$el.fadeOut();
						if(hotSpot.$popover) {
							hotSpot.$popover.addClass("ipnrm-hidden");
						}
						this.updateHotSpots(this.camera, w, h, hotSpot);
					}
				}
				
				if(hotSpot.$popover && hotSpot.$popover.hasClass("ipnrm-active") && !hotSpot.$popover.hasClass(this.config.popoverHideClass) ) {
					this.showPopover(hotSpot);
				}
			}
		},
		
		updateHotSpots: function(camera, w, h, hotSpot) {
			var pos = this.getHotSpotScreenPos(hotSpot, camera, w, h);
			hotSpot.$el.css({top: pos.y - hotSpot.$el.height()/2, left: pos.x - hotSpot.$el.width()/2});
		},
		
		getHotSpotScreenPos: function(hotSpot, camera, w, h) {
			var v = new THREE.Vector3( hotSpot.xyz.x, hotSpot.xyz.y, hotSpot.xyz.z );
			v.project( camera );
			
			v.x = (v.x + 1) / 2 * w;
			v.y = -(v.y - 1) / 2 * h;
			
			return {x: v.x, y: v.y};
		},
		
		applyHandlers: function() {
			this.controls.$loadBtn.on( "click.ipanorama", $.proxy(this.onLoadBtnClick, this) );
			this.controls.$sceneMenu.on( "click.ipanorama", $.proxy(this.onSceneMenuClick, this) );
			this.controls.$scenePrev.on( "click.ipanorama", $.proxy(this.onScenePrevClick, this) );
			this.controls.$sceneNext.on( "click.ipanorama", $.proxy(this.onSceneNextClick, this) );
			this.controls.$zoomIn.on( "click.ipanorama", $.proxy(this.onZoomIn, this) );
			this.controls.$zoomOut.on( "click.ipanorama", $.proxy(this.onZoomOut, this) );
			this.controls.$share.on( "click.ipanorama", $.proxy(this.onShare, this) );
			this.controls.$fullscreen.on( "click.ipanorama", $.proxy(this.onFullScreen, this) );
			this.controls.$autorotate.on( "click.ipanorama", $.proxy(this.onAutoRotate, this) );
			this.controls.$view.on( "click.ipanorama", $.proxy(this.onMouseClick, this) );
			this.controls.$view.on( "mousewheel.ipanorama DOMMouseScroll.ipanorama" , $.proxy(this.onMouseWheel, this) );
			
			
			if(this.config.showSceneThumbsCtrl || this.config.showSceneMenuCtrl) {
				this.controls.$sceneThumbs.find(".ipnrm-scene-thumb").on( "click.ipanorama", $.proxy(this.onSceneThumbClick, this) );
				this.controls.$sceneThumbs.on("mousewheel.ipanorama DOMMouseScroll.ipanorama", $.proxy(this.onSceneThumbsWheel, this) );
				this.controls.$sceneThumbs.on("mousedown.ipanorama", $.proxy(this.onSceneThumbsGrabMouseDown, this) );
				this.controls.$sceneThumbs.on("touchstart.ipanorama", $.proxy(this.onSceneThumbsGrabTouchStart, this) );
				this.controls.$sceneThumbs.on("touchmove.ipanorama", $.proxy(this.onSceneThumbsGrabTouchMove, this) );
				this.controls.$sceneThumbs.on("touchend.ipanorama", $.proxy(this.onSceneThumbsGrabTouchEnd, this) );
			}
			
			if(this.config.pinchZoom) {
				this.controls.$view.on("touchstart.ipanorama-pinchzoom", $.proxy(this.onMultiTouchStart, this) );
				this.controls.$view.on("touchend.ipanorama-pinchzoom", $.proxy(this.onMultiTouchEnd, this) );
			}
			
			if(this.config.grab) {
				this.controls.$view.on("mousedown.ipanorama-grab", $.proxy(this.onGrabMouseDown, this) );
				this.controls.$view.on("touchstart.ipanorama-grab", $.proxy(this.onGrabTouchStart, this) );
				this.controls.$view.on("touchmove.ipanorama-grab", $.proxy(this.onGrabTouchMove, this) );
				this.controls.$view.on("touchend.ipanorama-grab", $.proxy(this.onGrabTouchEnd, this) );
			}
			
			if(this.config.showControlsOnHover) {
				this.controls.$panorama.one("mousemove.ipanorama", $.proxy(this.onPanoramaEnter, this) );
				this.controls.$panorama.on("mouseenter.ipanorama", $.proxy(this.onPanoramaEnter, this) );
				this.controls.$panorama.on("mouseleave.ipanorama", $.proxy(this.onPanoramaLeave, this) );
			}
			
			if(this.config.hoverGrab) {
				this.controls.$panorama.on("mouseenter.ipanorama", $.proxy(this.onHoverGrabEnter, this) );
				this.controls.$panorama.on("mouseleave.ipanorama", $.proxy(this.onHoverGrabLeave, this) );
			}
			
			this.controls.$panorama.on("blur.ipanorama", $.proxy(this.onBlur, this) );
			this.controls.$panorama.on("keydown.ipanorama", $.proxy(this.onKeyDown, this) );
			this.controls.$panorama.on("keyup.ipanorama", $.proxy(this.onKeyUp, this) );
			this.controls.$panorama.on("fullscreenchange.ipanorama" + 
				" mozfullscreenchange.ipanorama" +
				" webkitfullscreenchange.ipanorama" +
				" msfullscreenchange.ipanorama", $.proxy(this.onFullScreenChange, this) );
			
			// Note: use id of the instance otherwise this event will be shared between copies
			$(window).on("resize.ipanorama-" + this.id, $.proxy(this.onResize, this) );
			$(window).on("blur.ipanorama-" + this.id, $.proxy(this.onBlur, this) );
			
			$(document).on("visibilitychange.ipanorama-" + this.id, $.proxy(this.onVisibilityChange, this) );
		},
		
		resetHandlers: function() {
			this.controls.$loadBtn.off( "click.ipanorama" );
			this.controls.$sceneMenu.off( "click.ipanorama" );
			this.controls.$scenePrev.off( "click.ipanorama" );
			this.controls.$sceneNext.off( "click.ipanorama" );
			this.controls.$zoomIn.off( "click.ipanorama" );
			this.controls.$zoomOut.off( "click.ipanorama" );
			this.controls.$share.off( "click.ipanorama" );
			this.controls.$fullscreen.off( "click.ipanorama" );
			this.controls.$view.off( "click.ipanorama" );
			this.controls.$view.off( "mousewheel.ipanorama DOMMouseScroll.ipanorama" );
			
			this.controls.$sceneThumbs.off( "mousewheel.ipanorama DOMMouseScroll.ipanorama" );
			this.controls.$sceneThumbs.find(".ipnrm-scene-thumb").off( "click.ipanorama" );
			
			if(this.config.grab) {
				this.controls.$view.off( "mousedown.ipanorama-grab" );
				this.controls.$view.off( "touchstart.ipanorama-grab" );
				this.controls.$view.off( "touchmove.ipanorama-grab" );
				this.controls.$view.off( "touchend.ipanorama-grab" );
			}
			
			if(this.config.pinchZoom) {
				this.controls.$view.off( "touchstart.ipanorama-pinchzoom" );
				this.controls.$view.off( "touchmove.ipanorama-pinchzoom" );
				this.controls.$view.off( "touchend.ipanorama-pinchzoom" );
			}
			
			if(this.config.showControlsOnHover) {
				this.controls.$panorama.off( "mouseenter.ipanorama" );
				this.controls.$panorama.off( "mouseleave.ipanorama" );
			}
			
			this.controls.$panorama.off( "blur.ipanorama" );
			this.controls.$panorama.off( "keydown.ipanorama" );
			this.controls.$panorama.off( "keyup.ipanorama" );
			this.controls.$panorama.off( "fullscreenchange.ipanorama" +
				" mozfullscreenchange.ipanorama" +
				" webkitfullscreenchange.ipanorama" +
				" msfullscreenchange.ipanorama" );
			$(window).off( "mousemove.ipanorama-" + this.id );
			$(window).off( "mouseup.ipanorama-" + this.id );
			$(window).off( "resize.ipanorama-" + this.id );
			$(window).off( "blur.ipanorama-" + this.id );
			
			$(document).off("visibilitychange.ipanorama-" + this.id );
		},
		
		onVisibilityChange: function(e) {
			if( document.visibilityState == 'visible' && this.sceneId) {
				this.refreshLayout();
				this.loadScene(this.sceneId);
			}
		},
		
		onHotSpotSceneClick: function(hotSpot, e) {
			e.preventDefault();
			e.stopPropagation();
			
			this.loadScene(hotSpot.sceneId);
		},
		
		onHotSpotClick: function(hotSpot, e) {
			if( !hotSpot.$popover || !hotSpot.$popover.hasClass("ipnrm-active") ) {
				e.stopImmediatePropagation();   // prevent close the popover
			}
			this.showPopover(hotSpot);
		},
		
		onHotSpotEnter: function(hotSpot, e) {
			this.showPopover(hotSpot);
		},
		
		onHotSpotTouchStart: function(hotSpot, e) {
			this.showPopover(hotSpot);
		},
		
		onHotSpotTouchEnd: function(hotSpot, e) {
			if($(e.target).is('a')) {
				// prevent delay and simulated mouse events
				e.preventDefault();
				
				// trigger the actual behavior we bound to the 'click' event
				e.target.click();
			}
		},
		
		onHotSpotLeave: function(hotSpot, e) {
			if(!hotSpot.$popover) {
				return;
			}
			
			var target = e.toElement || e.relatedTarget;
			if(hotSpot.$popover.has(target).length === 0 && !hotSpot.$popover.is(target) && !hotSpot.$el.is(target) ) {
				this.hidePopover(hotSpot);
			} else {
				hotSpot.$popover.one("mouseleave.ipanorama", $.proxy(this.onHotSpotLeave, this, hotSpot) );
			}
		},
		
		onPopoverHide: function(hotSpot, e) {
			if(!hotSpot.$popover) {
				return;
			}
			
			if(hotSpot.$popover.has(e.target).length === 0 || $(e.target).hasClass("ipnrm-close")) {
				if($(e.target).hasClass("ipnrm-close")) {
					e.stopImmediatePropagation();
				}
				
				this.hidePopover(hotSpot);
			}
		},
		
		onPopoverClick: function(hotSpot, e) {
			if(!hotSpot.$popover) {
				return;
			}
			
			this.liftupPopover(hotSpot);
		},
		
		onFullScreenChange: function() {
			if (this.util().isiOS()) {
				return;
			}
			
			if (document.fullscreen || document.mozFullScreen || document.webkitIsFullScreen || document.msFullscreenElement) {
				this.controls.$panorama.addClass("ipnrm-fullscreen");
				this.controls.$fullscreen.addClass("ipnrm-active");
			} else {
				this.controls.$panorama.removeClass("ipnrm-fullscreen");
				this.controls.$fullscreen.removeClass("ipnrm-active");
			}
			
			var _self = this;
			setTimeout(function() {
				_self.refreshLayout();
			}, 100);
		},
		
		toggleFullScreen: function() {
			if(!this.util().isiOS()) {
				if (!this.controls.$fullscreen.hasClass("ipnrm-active")) {
					try {
						var el = this.controls.$panorama.get(0);
						if(el.requestFullscreen) { el.requestFullscreen(); }
						else if(el.mozRequestFullScreen) { el.mozRequestFullScreen(); } 
						else if(el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); } 
						else if(el.msRequestFullscreen) { el.msRequestFullscreen(); }
					} catch(event) {
						// fullscreen doesn't work
					}
				} else {
					try {
						if(document.exitFullscreen) { document.exitFullscreen(); }
						else if(document.mozCancelFullScreen) { document.mozCancelFullScreen(); }
						else if(document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
						else if(document.msExitFullscreen) { document.msExitFullscreen(); }
					} catch(event) {
					}
				}
			} else {
				if (!this.controls.$panorama.hasClass("ipnrm-fullscreen")) {
					this.controls.$panorama.addClass("ipnrm-fullscreen ipnrm-fullscreen-emulation");
					this.controls.$panorama.get(0).offsetHeight;
					this.controls.$fullscreen.addClass("ipnrm-active");
				} else {
					this.controls.$panorama.removeClass("ipnrm-fullscreen ipnrm-fullscreen-emulation");
					this.controls.$panorama.get(0).offsetHeight;
					this.controls.$fullscreen.removeClass("ipnrm-active");
				}
				
				var _self = this;
				setTimeout(function() {
					_self.refreshLayout();
				}, 100);
			}
		},
		
		toggleAutoRotate: function() {
			this.config.autoRotate = this.autoRotate.enabled = !this.autoRotate.enabled;
			this.timeInteraction = Date.now() - this.config.autoRotateInactivityDelay;
			
			if(this.autoRotate.enabled) {
				this.controls.$autorotate.addClass("ipnrm-active");
				this.animateStart();
			} else {
				this.controls.$autorotate.removeClass("ipnrm-active");
			}
		},
		
		toggleGrab: function() {
			this.config.grab = !this.config.grab;
			if(this.config.grab) {
				this.controls.$view.on("mousedown.ipanorama", $.proxy(this.onGrabMouseDown, this) );
				this.controls.$view.on("touchstart.ipanorama", $.proxy(this.onGrabTouchStart, this) );
				this.controls.$view.on("touchmove.ipanorama", $.proxy(this.onGrabTouchMove, this) );
				this.controls.$view.on("touchend.ipanorama", $.proxy(this.onGrabTouchEnd, this) );
			} else {
				this.controls.$view.off( "mousedown.ipanorama" );
				this.controls.$view.off( "touchstart.ipanorama" );
				this.controls.$view.off( "touchmove.ipanorama" );
				this.controls.$view.off( "touchend.ipanorama" );
			}
			
		},
		
		onFullScreen: function() {
			this.toggleFullScreen();
		},
		
		onAutoRotate: function() {
			this.toggleAutoRotate();
		},
		
		onShare: function(e) {
			if (typeof this.config.onShare == "function") { // make sure the callback is a function
				this.config.onShare.call(this, e); // brings the scope to the callback
			}
		},
		
		onMouseClick: function(e) {
			// only do something if the panorama is loaded
			if (this.isLoading()) {
				return;
			}
			
			this.getHotSpotParameters(e);
		},
		
		onGrabMouseDown: function(e) {
			e.preventDefault();
			e.stopPropagation();
			
			// only do something if the panorama is loaded
			if (this.isLoading() || this.hotSpotSetupControl.enabled) {
				return;
			}
			
			this.controls.$panorama.focus();
			this.applyGrabControl(e);
			
			$(window).on("mousemove.ipanorama-" + this.id, $.proxy(this.onGrabMouseMove, this) );
			$(window).on("mouseup.ipanorama-" + this.id, $.proxy(this.onGrabMouseUp, this) );
		},
		
		onGrabMouseMove: function(e) {
			this.updateGrabControl(e);
		},
		
		onGrabMouseUp: function(e) {
			this.resetGrabControl(e);
			
			$(window).off( "mousemove.ipanorama-" + this.id );
			$(window).off( "mouseup.ipanorama-" + this.id );
		},
		
		onGrabTouchStart: function(e) {
			// only do something if the panorama is loaded
			if (this.isLoading()) {
				return;
			}
			
			this.applyGrabControl(e);
		},
		
		onGrabTouchMove: function(e) {
			// only do something if the panorama is loaded
			if (this.isLoading()) {
				return;
			}
			
			if(this.grabControl.enabled && !this.pinchZoom.startDate){
				e.preventDefault();
				
				var pos = this.getMousePosition(e.originalEvent.targetTouches[0]);
				
				this.yaw.valuePrev = this.yaw.value;
				this.pitch.valuePrev = this.pitch.value;
				
				this.yaw.value = (this.grabControl.x - pos.x) * this.config.grabCoef + this.grabControl.yawSaved;
				this.pitch.value = (pos.y - this.grabControl.y) * this.config.grabCoef + this.grabControl.pitchSaved;
				
				this.controlYawPitchLimits();
			}
		},
		
		onGrabTouchEnd: function(e) {
			this.resetGrabControl(e);
		},
		
		onMultiTouchStart: function(e) {
			// only do something if the panorama is loaded
			if (this.isLoading()) {
				return;
			}
			
			this.pinchZoom.aStart = e.originalEvent.touches[0] && e.originalEvent.touches.length > 1;
			this.pinchZoom.bStart = e.originalEvent.touches[1];
			
			if (!this.pinchZoom.aIsMoving && !this.pinchZoom.bIsMoving && this.pinchZoom.aStart && this.pinchZoom.bStart) {
				if(this.config.pinchZoomPreventDefault) {
					e.preventDefault();
					e.stopPropagation();
				}
				
				this.pinchZoom.aStartX = e.originalEvent.touches[0].pageX;
				this.pinchZoom.aStartY = e.originalEvent.touches[0].pageY;
				this.pinchZoom.bStartX = e.originalEvent.touches[1].pageX;
				this.pinchZoom.bStartY = e.originalEvent.touches[1].pageY;
				
				this.controls.$view.on("touchmove.ipanorama-pinchzoom", $.proxy(this.onMultiTouchMove, this) );
				
				// Set the start date and current X/Y for finger "a" & finger "b".
				this.pinchZoom.zoom = this.zoom.value;
				this.pinchZoom.startDate = new Date().getTime();
				this.pinchZoom.aCurX = this.pinchZoom.aStartX;
				this.pinchZoom.aCurY = this.pinchZoom.aStartY;
				this.pinchZoom.bCurX = this.pinchZoom.bStartX;
				this.pinchZoom.bCurY = this.pinchZoom.bStartY;
				this.pinchZoom.aIsMoving = true;
				this.pinchZoom.bIsMoving = true;
			}
		},
		
		onMultiTouchMove: function(e) {
			if (this.config.preventDefault) {
				e.preventDefault();
				e.stopPropagation();
			}
			
			if (this.pinchZoom.aIsMoving || this.pinchZoom.bIsMoving) {
				this.pinchZoom.aCurX = e.originalEvent.touches[0].pageX;
				this.pinchZoom.aCurY = e.originalEvent.touches[0].pageY;
				this.pinchZoom.bCurX = e.originalEvent.touches[1].pageX;
				this.pinchZoom.bCurY = e.originalEvent.touches[1].pageY;
				
				// If there's a MultiTouchMove event, call it passing
				// current X and Y position (curX and curY).
				var endDate = new Date().getTime(), // current date to calculate timing
				ms = this.pinchZoom.startDate - endDate; // duration of touch in milliseconds
				
				var ax = this.pinchZoom.aCurX, // current left position of finger 'a'
				ay = this.pinchZoom.aCurY, // current top position of finger 'a'
				bx = this.pinchZoom.bCurX, // current left position of finger 'b'
				by = this.pinchZoom.bCurY, // current top position of finger 'b'
				dax = ax - this.pinchZoom.aStartX, // diff of current left to starting left of finger 'a'
				day = ay - this.pinchZoom.aStartY, // diff of current top to starting top of finger 'a'
				dbx = bx - this.pinchZoom.bStartX, // diff of current left to starting left of finger 'b'
				dby = by - this.pinchZoom.bStartY, // diff of current top to starting top of finger 'b'
				aax = Math.abs(dax), // amount of horizontal movement of finger 'a'
				aay = Math.abs(day), // amount of vertical movement of finger 'a'
				abx = Math.abs(dbx), // amount of horizontal movement of finger 'b'
				aby = Math.abs(dby); // amount of vertical movement of finger 'b'
				
				//diff of current starting distance to starting distance between the 2 points
				var diff = Math.sqrt((this.pinchZoom.aStartX - this.pinchZoom.bStartX) * (this.pinchZoom.aStartX - this.pinchZoom.bStartX) + (this.pinchZoom.aStartY - this.pinchZoom.bStartY) * (this.pinchZoom.aStartY - this.pinchZoom.bStartY)) - Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
				
				this.zoom.value = Math.max(this.zoom.min, Math.min(this.zoom.max, this.pinchZoom.zoom + diff * this.config.pinchZoomCoef));
			}
		},
		
		onMultiTouchEnd: function(e) {
			if(this.config.pinchZoomPreventDefault) {
				e.preventDefault();
				e.stopPropagation();
			}
			
			// when touch events are not present, use mouse events.
			this.controls.$view.off("touchmove.ipanorama-pinchzoom");
			
			this.multiTouchReset();
		},
		
		multiTouchReset: function() {
			this.pinchZoom.aStartX = false;
			this.pinchZoom.aStartY = false;
			this.pinchZoom.bStartX = false;
			this.pinchZoom.bStartY = false;
			this.pinchZoom.startDate = false;
			this.pinchZoom.aIsMoving = false;
			this.pinchZoom.bIsMoving = false;
		},
		
		onHoverGrabEnter: function(e) {
			// only do something if the panorama is loaded
			if (this.isLoading()) {
				return;
			}
			
			if(!this.hoverGrabControl.enabled) {
				this.hoverGrabControl.enabled = true;
				this.controls.$panorama.on("mousemove.ipanorama", $.proxy(this.onHoverGrabMove, this) );
				
				this.resetTransition();
				this.animateStart();
			}
		},
		
		onHoverGrabLeave: function(e) {
			if( this.hoverGrabControl.enabled ) {
				this.hoverGrabControl.enabled = false;
				this.controls.$panorama.off( "mousemove.ipanorama" );
			}
		},
		
		onHoverGrabMove: function(e) {
			// only do something if the panorama is loaded
			if (this.isLoading()) {
				return;
			}
			
			var power = this.getMousePositionPower(e);
			this.hoverGrabControl.power = power;
			
			if( this.hoverGrabControl.enabled && !this.grabControl.enabled) {
				this.yaw.valuePrev = this.yaw.value;
				this.pitch.valuePrev = this.pitch.value;
				
				this.yaw.value = this.hoverGrabControl.yawSaved + power.x * this.config.hoverGrabYawCoef;
				this.pitch.value = this.hoverGrabControl.pitchSaved + power.y * this.config.hoverGrabPitchCoef;
				
				this.controlYawPitchLimits();
			}
		},
		
		onPanoramaEnter: function(e) {
			this.controls.$panorama.removeClass("ipnrm-hide-controls");
			this.refreshLayout();
		},
		
		onPanoramaLeave: function(e) {
			this.controls.$panorama.addClass("ipnrm-hide-controls");
			this.refreshLayout();
		},
		
		onKeyDown: function(e) {
			// only do something if the panorama is loaded
			if (this.isLoading()) {
				return;
			}
			
			this.autoRotate.enabled = false;
			this.timeInteraction = Date.now();
			
			if((e.ctrlKey || e.metaKey) && this.config.hotSpotSetup && !this.grabControl.enabled) {
				this.applyHotSpotSetupControl();
				return;
			}
			
			if(e.keyCode === 38 && this.config.keyboardNav === true) { // up
				this.setPitch(this.pitch.value + 10);
			} else if(e.keyCode === 40 && this.config.keyboardNav === true) { // down
				this.setPitch(this.pitch.value - 10);
			} else if(e.keyCode === 37 && this.config.keyboardNav === true) { // left
				this.setYaw(this.yaw.value - 10);
			} else if(e.keyCode === 39 && this.config.keyboardNav === true) { // right
				this.setYaw(this.yaw.value + 10);
			} else if ((e.keyCode === 189 || e.keyCode === 109) && this.config.keyboardZoom === true) { // minus
				this.setZoom(this.zoom.value + 10);
			} else if ((e.keyCode === 187 || e.keyCode === 107) && this.config.keyboardZoom === true) { // plus
				this.setZoom(this.zoom.value - 10);
			}
		},
		
		onKeyUp: function(e) {
			if(this.config.hotSpotSetup) {
				this.resetHotSpotSetupControl();
			}
			
			if(this.config.autoRotate) {
				this.autoRotate.enabled = true;
				this.timeInteraction = Date.now();
				
				this.animateStart();
			}
		},
		
		resize: function() {
			// only do something if the panorama is loaded
			if (this.isLoading()) {
				return;
			}
			
			var w = this.controls.$view.width(),
			h = this.controls.$view.height();
			
			if(w == 0 && h ==0) {
				var $sizeEl = $(this.config.containerSizeSelector);
				
				w = $sizeEl.width();
				h = $sizeEl.height();
			}
			
			this.aspect = w/h;
			this.camera.aspect = this.aspect;
			this.camera.updateProjectionMatrix();

			this.renderer.setSize( w, h );
			
			this.animateStart();
		},
		
		refreshLayout: function() {
			this.resize();
			this.onFullScreenChange();
		},
		
		onResize: function(e) {
			this.refreshLayout();
		},

		onBlur: function (e) {
			this.resetHotSpotSetupControl();
			this.timePrev = undefined;
		},
		
		onLoadBtnClick: function(e) {
			this.controls.$loadBtn.hide(); // hide the load button
			this.loadScene(this.config.sceneId);
		},
		
		onSceneThumbClick: function(e) {
			var sceneId = $(e.currentTarget).attr("data-sceneid");
			this.loadScene(sceneId);
		},
		
		onSceneThumbsGrabMouseDown: function(e) {
			e.preventDefault();
			e.stopPropagation();
			
			this.applySceneThumbsGrabControl(e);
			
			$(window).on("mousemove.ipanorama-" + this.id + "-thumbs", $.proxy(this.onSceneThumbsGrabMouseMove, this) );
			$(window).on("mouseup.ipanorama-" + this.id + "-thumbs", $.proxy(this.onSceneThumbsGrabMouseUp, this) );
		},
		
		onSceneThumbsGrabMouseMove: function(e) {
			this.updateSceneThumbsGrabControl(e);
		},
		
		onSceneThumbsGrabMouseUp: function(e) {
			this.resetSceneThumbsGrabControl(e);
			
			$(window).off( "mousemove.ipanorama-" + this.id + "-thumbs" );
			$(window).off( "mouseup.ipanorama-" + this.id + "-thumbs" );
		},
		
		onSceneThumbsGrabTouchStart: function(e) {
			this.applySceneThumbsGrabControl(e);
		},
		
		onSceneThumbsGrabTouchMove: function(e) {
			e.preventDefault();
			
			this.updateSceneThumbsGrabControl(e);
		},
		
		onSceneThumbsGrabTouchEnd: function(e) {
			this.resetSceneThumbsGrabControl(e);
		},
		
		onSceneThumbsWheel: function(e) {
			e.preventDefault();
			
			var e = e.originalEvent,
			direction = 1;
			
			if (e.wheelDeltaY) { // WebKit
				direction = (e.wheelDeltaY > 0 ? -1 : 1);
			} else if (e.wheelDelta) { // Opera / Explorer 9
				direction = (e.wheelDelta > 0 ? -1 : 1);
			} else if (e.detail) { // Firefox
				direction = (e.detail > 0 ? 1 : -1);
			}
			
			var thumbIndex = this.sceneThumbIndex + direction;
			
			if( thumbIndex < 0 || this.sceneIdThumbsArray.length <= 1 ) {
				thumbIndex = 0;
			} else if( thumbIndex >= (this.sceneIdThumbsArray.length - 1) ) {
				thumbIndex = this.sceneIdThumbsArray.length - 1;
			}
				
			this.sceneThumbIndex = thumbIndex;
			this.moveToSceneThumb(thumbIndex);
		},
		
		moveToSceneThumb: function(index) {
			var sceneId = this.sceneIdThumbsArray[index],
			$thumb = this.controls.$sceneThumbsInner.find(".ipnrm-scene-thumb[data-sceneid='" + sceneId + "']"),
			offsetParent = this.getOffsetRect(this.controls.$sceneThumbsInner),
			offsetThumb = ($thumb.length ? this.getOffsetRect($thumb) : 0),
			marginsThumb = ($thumb.length ? this.getMargins($thumb) : 0);
			
			var offsetTop = offsetParent.top - (offsetThumb.top - marginsThumb.top),
			offsetLeft = offsetParent.left - (offsetThumb.left - marginsThumb.left);
			
			this.sceneThumbsControl.topSaved = offsetTop;
			this.sceneThumbsControl.leftSaved = offsetLeft;
			
			this.updateSceneThumbs(offsetTop, offsetLeft);
		},
		
		updateSceneThumbs: function(top, left) {
			if(this.config.sceneThumbsVertical) {
				this.controls.$sceneThumbsInner.css({
					'transform': 'translate3d(0px, ' + top + 'px, 0px)',
					'-webkit-transform': 'translate3d(0px, ' + top + 'px, 0px)'
				});
			} else {
				this.controls.$sceneThumbsInner.css({
					'transform': 'translate3d(' + left + 'px, 0px, 0px)',
					'-webkit-transform': 'translate3d(' + left + 'px, 0px, 0px)'
				});
				
			}
		},
		
		onSceneMenuClick: function(e) {
			this.controls.$sceneThumbs.toggleClass("ipnrm-active");
			
			if(this.controls.$sceneThumbs.hasClass("ipnrm-active")) {
				this.controls.$sceneMenu.addClass("ipnrm-active");
				this.controls.$panorama.addClass("ipnrm-scene-thumbs-active");
			} else {
				this.controls.$sceneMenu.removeClass("ipnrm-active");
				this.controls.$panorama.removeClass("ipnrm-scene-thumbs-active");
				this.config.showSceneThumbsCtrl = false;
			}
			
			this.refreshSceneThumb(this.sceneId);
			this.refreshLayout();
		},
		
		onScenePrevClick: function(e) {
			var prevSceneId = this.getPrevSceneId(this.sceneId);
			if(prevSceneId) {
				this.loadScene(prevSceneId);
			} else if(this.config.sceneNextPrevLoop) {
				this.loadScene(this.getLastSceneId());
			}
		},
		
		onSceneNextClick: function(e) {
			var nextSceneId = this.getNextSceneId(this.sceneId);
			if(nextSceneId) {
				this.loadScene(nextSceneId);
			} else if(this.config.sceneNextPrevLoop) {
				this.loadScene(this.getFirstSceneId());
			}
		},
		
		onZoomIn: function(e) {
			if (this.isLoading()) {
				return;
			}
			this.setZoom(this.zoom.value - 10);
		},
		
		onZoomOut: function(e) {
			if (this.isLoading()) {
				return;
			}
			this.setZoom(this.zoom.value + 10);
		},
		
		onMouseWheel: function(e) {
			// sometimes we need to disable/enable default behavior
			if(this.config.mouseWheelPreventDefault) {
				e.preventDefault();
				e.stopPropagation();
			}
			
			// Only do something if the panorama is loaded
			if (this.isLoading()) {
				return;
			}
			
			var e = e.originalEvent;
			if (e.wheelDeltaY) {
				// WebKit
				if(this.config.mouseWheelRotate) {
					this.setYaw(this.yaw.value - e.wheelDeltaY * this.config.mouseWheelRotateCoef);
				} else if(this.config.mouseWheelZoom) {
					this.setZoom(this.zoom.value - e.wheelDeltaY * this.config.mouseWheelZoomCoef);
				}
				
			} else if (e.wheelDelta) {
				// Opera / Explorer 9
				if(this.config.mouseWheelRotate) {
					this.setYaw(this.yaw.value - e.wheelDelta * this.config.mouseWheelRotateCoef);
				} else if(this.config.mouseWheelZoom) {
					this.setZoom(this.zoom.value - e.wheelDelta * this.config.mouseWheelZoomCoef);
				}
			} else if (e.detail) {
				// Firefox
				if(this.config.mouseWheelRotate) {
					this.setYaw(this.yaw.value + e.detail * this.config.mouseWheelRotateCoef * 100);
				} else if(this.config.mouseWheelZoom) {
					this.setZoom(this.zoom.value + e.detail * this.config.mouseWheelZoomCoef * 100);
				}
			}
		},
		
		setYaw: function(yaw, duration) {
			this.yaw.valuePrev = this.yaw.value;
			this.yaw.valueNext = yaw;
			this.yaw.time = 0;
			this.yaw.duration = (duration ? duration : 1000);
			
			this.animateStart();
		},
		
		setPitch: function(pitch, duration) {
			this.pitch.valuePrev = this.pitch.value;
			this.pitch.valueNext = pitch;
			this.pitch.time = 0;
			this.pitch.duration = (duration ? duration : 1000);
			
			this.animateStart();
		},
		
		setZoom: function(zoom, duration) {
			this.zoom.valuePrev = this.zoom.value;
			this.zoom.valueNext = zoom;
			this.zoom.time = 0;
			this.zoom.duration = (duration ? duration : 500);

			this.animateStart();
		},
		
		applySceneThumbsGrabControl: function(e) {
			var pos = {x:0,y:0};
			if(window.TouchEvent && e.originalEvent instanceof TouchEvent) {
				pos = this.getMousePosition(e.originalEvent.targetTouches[0]);
			} else {
				pos.x = e.clientX;
				pos.y = e.clientY;
			}
			
			this.sceneThumbsControl.grab = true;
			this.sceneThumbsControl.x = pos.x;
			this.sceneThumbsControl.y = pos.y;
			this.sceneThumbsControl.top = this.sceneThumbsControl.topSaved;
			this.sceneThumbsControl.left = this.sceneThumbsControl.leftSaved;
			
			this.controls.$sceneThumbsInner.addClass("ipnrm-notransition"); // disable transitions
		},
		
		updateSceneThumbsGrabControl: function(e) {
			if(this.sceneThumbsControl.grab) {
				var pos = {x:0,y:0};
				if(window.TouchEvent && e.originalEvent instanceof TouchEvent) {
					pos = this.getMousePosition(e.originalEvent.targetTouches[0]); // calculate touch position relative to top left of viewer container
				} else {
					pos.x = e.clientX;
					pos.y = e.clientY;
				}
				
				this.sceneThumbsControl.top = this.sceneThumbsControl.topSaved + pos.y - this.sceneThumbsControl.y;
				this.sceneThumbsControl.left = this.sceneThumbsControl.leftSaved + pos.x - this.sceneThumbsControl.x,
				
				this.updateSceneThumbs(this.sceneThumbsControl.top, this.sceneThumbsControl.left);
			}
		},
		
		resetSceneThumbsGrabControl: function(e) {
			if(this.sceneThumbsControl.grab) {
				this.sceneThumbsControl.grab = false;
				this.sceneThumbsControl.topSaved = this.sceneThumbsControl.top;
				this.sceneThumbsControl.leftSaved = this.sceneThumbsControl.left;
				
				var _this = this,
				thumbIndex = 0;
				this.controls.$sceneThumbsInner.find(".ipnrm-scene-thumb").each(function ( index ) {
					var $thumb = $(this),
					offsetParent = _this.getOffsetRect(_this.controls.$sceneThumbs),
					offsetThumb = _this.getOffsetRect($thumb),
					offset = 0;
					
					if(_this.config.sceneThumbsVertical) {
						offset = offsetThumb.top + (offsetThumb.height / 2) - offsetParent.top;
					} else {
						offset = offsetThumb.left + (offsetThumb.width / 2) - offsetParent.left;
					}
					
					thumbIndex = index;
					
					if(offset > 0) {
						return false;
					}
				});
				
				this.controls.$sceneThumbsInner[0].offsetHeight; // trigger a reflow, flushing the CSS changes
				this.controls.$sceneThumbsInner.removeClass("ipnrm-notransition"); // enable transitions
				
				this.sceneThumbIndex = thumbIndex;
				this.moveToSceneThumb(thumbIndex);
			}
		},
		
		applyGrabControl: function(e) {
			this.setViewCursorShape("ipnrm-grabbing");
			
			this.autoRotate.enabled = false;
			this.timeInteraction = Date.now();
			
			var pos = {x:0,y:0};
			if(window.TouchEvent && e.originalEvent instanceof TouchEvent) {
				pos = this.getMousePosition(e.originalEvent.targetTouches[0]);
			} else {
				pos.x = e.clientX;
				pos.y = e.clientY;
			}
			
			this.grabControl.enabled = true;
			this.grabControl.x = pos.x;
			this.grabControl.y = pos.y;
			this.grabControl.yawSaved = this.yaw.value;
			this.grabControl.pitchSaved = this.pitch.value;
			
			this.resetTransition();
			
			this.animateStart();
		},
		
		updateGrabControl: function(e) {
			if(this.grabControl.enabled){
				this.timeInteraction = Date.now();
				
				var pos = {x:0,y:0};
				if(window.TouchEvent && e.originalEvent instanceof TouchEvent) {
					pos = this.getMousePosition(e.originalEvent.targetTouches[0]); // calculate touch position relative to top left of viewer container
				} else {
					pos.x = e.clientX;
					pos.y = e.clientY;
				}
				
				this.yaw.valuePrev = this.yaw.value;
				this.pitch.valuePrev = this.pitch.value;
				
				this.yaw.value = (this.grabControl.x - pos.x) * this.config.grabCoef + this.grabControl.yawSaved;
				this.pitch.value = (pos.y - this.grabControl.y) * this.config.grabCoef + this.grabControl.pitchSaved;
				
				this.controlYawPitchLimits();
			}
		},
		
		resetGrabControl: function(e) {
			if(this.grabControl.enabled) {
				if(this.config.autoRotate) {
					this.autoRotate.enabled = true;
				}
				
				this.grabControl.enabled = false;
				this.setViewCursorShape("ipnrm-grab");
				this.controlHoverGrabControl();
				
				var yawDelta = this.yaw.value - this.grabControl.yawSaved;
				var pitchDelta = this.pitch.value - this.grabControl.pitchSaved;
				
				this.setYaw(this.yaw.value + Math.sign(yawDelta)*1, 500);
				this.setPitch(this.pitch.value + Math.sign(pitchDelta)*1, 500);
			}
		},
		
		controlHoverGrabControl: function() {
			if(this.config.hoverGrab && this.hoverGrabControl.power) {
				var power = this.hoverGrabControl.power;
					
				var yaw = this.yaw.value - power.x * this.config.hoverGrabYawCoef,
				pitch = this.pitch.value - power.y * this.config.hoverGrabPitchCoef;
				
				var scene = this.config.scenes[this.sceneId];
				if(scene.yawLimits) {
					var yawDelta = this.yaw.valueInit - yaw;
					
					if(yawDelta < 0 && Math.abs(yawDelta) > scene.yawLimitLeft) {
						yaw = this.yaw.valueInit + scene.yawLimitLeft;
					} else if(yawDelta > 0 && Math.abs(yawDelta) > scene.yawLimitRight) {
						yaw = this.yaw.valueInit - scene.yawLimitRight;
					}
				}
				if(scene.pitchLimits) {
					var pitchDelta = this.pitch.valueInit - pitch;
					
					if(pitchDelta > 0 && Math.abs(pitchDelta) > scene.pitchLimitUp) {
						pitch = this.pitch.valueInit - scene.pitchLimitUp;
					} else if(pitchDelta < 0 && Math.abs(pitchDelta) > scene.pitchLimitDown) {
						pitch = this.pitch.valueInit + scene.pitchLimitDown;
					}
				}
				
				this.hoverGrabControl.yawSaved = yaw;
				this.hoverGrabControl.pitchSaved = pitch;
			}
		},
		
		applyHotSpotSetupControl: function() {
			if(!this.hotSpotSetupControl.enabled) {
				this.setViewCursorShape("ipnrm-target");
				this.hotSpotSetupControl.enabled = true;
			}
		},
		
		getHotSpotParameters: function(e) {
			if(this.hotSpotSetupControl.enabled || typeof this.config.onHotSpotSetup == "function") {
				var obj = this.getHotSpotYawPitch(e);
				
				if(this.hotSpotSetupControl.enabled) {
					console.log("yaw: " + obj.yaw + ", pitch: " + obj.pitch + ", camera yaw: " + this.yaw.value + ", camera pitch: " + this.pitch.value + ", camera zoom: " + this.zoom.value);
				}
				
				if (typeof this.config.onHotSpotSetup == "function") { // make sure the callback is a function
					this.config.onHotSpotSetup.call(this, obj.yaw, obj.pitch, this.yaw.value, this.pitch.value, this.zoom.value, e); // brings the scope to the callback
				}
			} 
		},
		
		getHotSpotYawPitch: function(e) {
			var parentOffset = this.controls.$view.offset(),
			x = e.pageX - parentOffset.left,
			y = e.pageY - parentOffset.top,
			rect = this.controls.$view.get(0).getBoundingClientRect(),
			w = rect.right - rect.left,
			h = rect.bottom - rect.top,
			dx =  (x/w)*2 - 1,
			dy =  1 - (y/h)*2;
			
			
			var v = new THREE.Vector3(dx, dy, 0.5);
			v.unproject( this.camera );
			
			var dir = v.sub( this.camera.position ).normalize();
			
			var yaw = Math.atan(dir.x/dir.z);
			var pitch = Math.atan(dir.y/Math.sqrt(dir.z*dir.z + dir.x*dir.x));
			
			yaw = -THREE.Math.radToDeg(yaw);
			pitch = THREE.Math.radToDeg(pitch);
			
			if(dir.z <= 0) {
				yaw = 180 + yaw;
			} else if(dir.x > 0) {
				yaw = 360 + yaw;
			}
			
			return {yaw: yaw, pitch: pitch};
		},
		
		resetHotSpotSetupControl: function() {
			this.setViewCursorShape("ipnrm-grab");
			this.hotSpotSetupControl.enabled = false;
		},
		
		setViewCursorShape: function(shapeName) {
			this.controls.$view.removeClass("ipnrm-grab");
			this.controls.$view.removeClass("ipnrm-grabbing");
			this.controls.$view.removeClass("ipnrm-target");
			
			if(this.config.grab || shapeName == "ipnrm-target") {
				this.controls.$view.addClass(shapeName);
			}
		},
		
		lookAt: function(yaw, pitch) {
			this.setYaw(yaw, 500);
			this.setPitch(pitch, 500);
		},
		
		// helper functions
		isLoading: function() {
			return this.loading || !this.scene;
		},
		
		getFirstSceneId: function() {
			var firstSceneId = null;
			for (var sceneId in this.config.scenes) {
				if (this.config.scenes.hasOwnProperty(sceneId)) {
					firstSceneId = sceneId;
					break;
				}
			}
			
			return firstSceneId;
		},
		
		getLastSceneId: function() {
			var lastSceneId = null;
			for (var sceneId in this.config.scenes) {
				if (this.config.scenes.hasOwnProperty(sceneId)) {
					lastSceneId = sceneId;
				}
			}
			
			return lastSceneId;
		},
		
		getPrevSceneId: function(curSceneId) {
			var flag = false, prevSceneId = null;
			for (var sceneId in this.config.scenes) {
				if (this.config.scenes.hasOwnProperty(sceneId)) {
					if(sceneId == curSceneId) {
						flag = true;
					}
					
					if(flag) {
						break;
					}
					
					prevSceneId = sceneId;
				}
			}
			
			return prevSceneId;
		},
		
		getNextSceneId: function(curSceneId) {
			var flag = false, nextSceneId = null;
			for (var sceneId in this.config.scenes) {
				if (this.config.scenes.hasOwnProperty(sceneId)) {
					if(flag) {
						nextSceneId = sceneId;
						break;
					}
					if(sceneId == curSceneId) {
						flag = true;
					}
				}
			}
			
			return nextSceneId;
		},
		
		getOffsetRect: function($el) {
			var rect = $el.get(0).getBoundingClientRect(),
			body = document.body,
			docElem = document.documentElement,
			scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop,
			scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft,
			clientTop = docElem.clientTop || body.clientTop || 0,
			clientLeft = docElem.clientLeft || body.clientLeft || 0,
			top  = rect.top +  scrollTop - clientTop,
			left = rect.left + scrollLeft - clientLeft;

			return { top: Math.round(top), left: Math.round(left), width: rect.width, height: rect.height };
		},
		
		getMargins: function($el) {
			var marginTop = parseInt($el.css("margin-top"), 10),
			marginBottom = parseInt($el.css("margin-bottom"), 10),
			marginLeft = parseInt($el.css("margin-left"), 10),
			marginRight = parseInt($el.css("margin-right"), 10);
			
			// we must check for NaN for ie 8/9
			if (isNaN(marginTop)) marginTop = 0; 
			if (isNaN(marginBottom)) marginBottom = 0;
			if (isNaN(marginLeft)) marginLeft = 0; 
			if (isNaN(marginRight)) marginRight = 0;
			
			return { top: marginTop, left: marginLeft, bottom: marginBottom, right: marginRight };
		},
		
		getPitchYawPoint: function(pitch, yaw) {
			var point = new THREE.Vector3( 0, 0, 0 );
			
			point.x = Math.sin( THREE.Math.degToRad(180 - yaw) ) * Math.cos( THREE.Math.degToRad(180 - pitch) );
			point.y = Math.sin( THREE.Math.degToRad(180 - pitch) );
			point.z = Math.cos( THREE.Math.degToRad(180 - yaw) ) * Math.cos( THREE.Math.degToRad(180 - pitch) );
			
			return point;
		},
		
		getMousePositionPower: function(e) {
			var rect = this.controls.$panorama.get(0).getBoundingClientRect();
			var power = {}, whalf = (rect.right - rect.left)/2, hhalf = (rect.bottom - rect.top)/2;
			
			var body = document.body,
			docElement = document.documentElement
			
			var scrollTop = window.pageYOffset || docElement.scrollTop || body.scrollTop,
			scrollLeft = window.pageXOffset || docElement.scrollLeft || body.scrollLeft,
			clientTop = docElement.clientTop || body.clientTop || 0,
			clientLeft = docElement.clientLeft || body.clientLeft || 0,
			top = rect.top +  scrollTop - clientTop,
			left = rect.left + scrollLeft - clientLeft,
			top = Math.round(top), 
			left = Math.round(left),
			top = e.pageY - top,
			left = e.pageX - left;
			
			power.x = (left - whalf) / whalf;
			power.y = (hhalf - top) / hhalf;
			
			power.x = (power.x < -1 ? -1 : (power.x > 1 ? 1 : power.x));
			power.y = (power.y < -1 ? -1 : (power.y > 1 ? 1 : power.y));
			
			return power;
		},
		
		applyInterpolation: function(obj, timeDelta) {
			if(obj.time < obj.duration) {
				obj.time += timeDelta;
				var t = obj.time / obj.duration;
				obj.value = obj.valuePrev + (obj.valueNext - obj.valuePrev) * t;
			}
		},
		
		createTexture: function(obj, key) {
			var texture = new THREE.Texture();
			texture.image = obj[key];
			texture.needsUpdate = true;
			
			return texture;
		},
		
		getMousePosition: function(e) {
			var rect = this.controls.$panorama.get(0).getBoundingClientRect();
			var pos = {};
			pos.x = e.clientX - rect.left;
			pos.y = e.clientY - rect.top;
			return pos;
		},
		
		showLoadInfo: function() {
			this.controls.$loadProgressBar.css({width: 0});
			this.controls.$loadInfo.css({display:""}).fadeTo("slow",1);
			this.controls.$loadInfo.get(0).offsetHeight;
		},
		
		hideLoadInfo: function() {
			this.controls.$loadInfo.fadeTo("slow",0, function() {$(this).css({display:"none"})});
		},
		
		applyScenePrevNextCtrls: function(sceneId) {
			if(!this.config.sceneNextPrevLoop) {
				var prevSceneId = this.getPrevSceneId(sceneId),
				nextSceneId = this.getNextSceneId(sceneId);
				
				if(prevSceneId) {
					this.controls.$scenePrev.removeClass("ipnrm-disable");
				} else {
					this.controls.$scenePrev.addClass("ipnrm-disable");
				}
				
				if(nextSceneId) {
					this.controls.$sceneNext.removeClass("ipnrm-disable");
				} else {
					this.controls.$sceneNext.addClass("ipnrm-disable");
				}
			}
		},
		
		applySceneThumbs: function(sceneId) {
			if(this.config.sceneThumbsVertical) {
				this.controls.$panorama.addClass("ipnrm-scene-thumbs-v").removeClass("ipnrm-scene-thumbs-h");
			} else {
				this.controls.$panorama.addClass("ipnrm-scene-thumbs-h").removeClass("ipnrm-scene-thumbs-v");
			}
			
			if(this.config.showSceneThumbsCtrl) {
				this.controls.$sceneThumbs.addClass("ipnrm-active");
				this.controls.$panorama.addClass("ipnrm-scene-thumbs-active");
			}
			
			this.refreshSceneThumb(sceneId);
		},
		
		refreshSceneThumb: function(sceneId) {
			if(this.controls.$sceneThumbs.hasClass("ipnrm-active")) {
				this.controls.$sceneThumbs.find(".ipnrm-scene-thumb.ipnrm-active").removeClass("ipnrm-active");
				this.controls.$sceneThumbs.find(".ipnrm-scene-thumb[data-sceneid='" + sceneId + "']").addClass("ipnrm-active");
				
				if(!this.config.sceneThumbsStatic) {
					var index = this.sceneIdThumbsArray.indexOf(sceneId);
					if(index >= 0) {
						this.moveToSceneThumb(index);
					}
				}
			}
		},
		
		applyControls: function(sceneId) {
			this.controls.$toolbar.fadeIn("slow");
			
			if(this.config.showSceneMenuCtrl) {
				this.controls.$sceneMenu.fadeIn("slow");
				this.controls.$panorama.removeClass("ipnrm-no-scene-menu-ctrl");
			} else {
				this.controls.$panorama.addClass("ipnrm-no-scene-menu-ctrl");
			}
			
			if(this.config.showSceneNextPrevCtrl) {
				this.controls.$sceneNext.fadeIn("slow");
				this.controls.$scenePrev.fadeIn("slow");
				this.controls.$panorama.removeClass("ipnrm-no-scene-nextprev-ctrl");
			} else {
				this.controls.$panorama.addClass("ipnrm-no-scene-nextprev-ctrl");
			}
			
			if(this.config.showZoomCtrl) {
				this.controls.$zoomIn.fadeIn("slow");
				this.controls.$zoomOut.fadeIn("slow");
				this.controls.$panorama.removeClass("ipnrm-no-zoom-ctrl");
			} else {
				this.controls.$panorama.addClass("ipnrm-no-zoom-ctrl");
			}
			
			if(this.config.showShareCtrl) {
				this.controls.$share.fadeIn("slow");
				this.controls.$panorama.removeClass("ipnrm-no-share-ctrl");
			} else {
				this.controls.$panorama.addClass("ipnrm-no-share-ctrl");
			}
			
			if(this.config.showFullscreenCtrl) {
				this.controls.$fullscreen.fadeIn("slow");
				this.controls.$panorama.removeClass("ipnrm-no-fullscreen-ctrl");
			} else {
				this.controls.$panorama.addClass("ipnrm-no-fullscreen-ctrl");
			}
			
			if(this.config.showAutoRotateCtrl) {
				this.controls.$autorotate.fadeIn("slow");
				this.controls.$panorama.removeClass("ipnrm-no-autorotate-ctrl");
			} else {
				this.controls.$panorama.addClass("ipnrm-no-autorotate-ctrl");
			}
			
			if(this.config.compass && this.config.scenes[sceneId].compassNorthOffset != null) { 
				this.controls.$compass.fadeIn("slow");
				this.controls.$panorama.removeClass("ipnrm-no-compass-ctrl");
			} else {
				this.controls.$compass.fadeOut("slow");
				this.controls.$panorama.addClass("ipnrm-no-compass-ctrl");
			}
			
			this.applyScenePrevNextCtrls(sceneId);
			this.applySceneThumbs(sceneId);
			this.applyTitle(sceneId);
		},
		
		applyTitle: function(sceneId) {
			if(this.config.title) {
				var scene = this.config.scenes[sceneId];
				if(scene.title) {
					var content = (typeof scene.title == "function" ? scene.title.call(sceneId) : scene.title);
					this.controls.$title.empty()[ // maintain js events
						(scene.titleHtml ? (typeof content == "string" ? "html" : "append") : "text")
					](content);
					this.controls.$title.fadeIn("slow");
				} else if(scene.titleSelector) {
					var el = $(scene.titleSelector);
					this.controls.$title.empty()[ // maintain js events
						(scene.titleHtml ? "html" : "text")
					](( el.html() ));
					this.controls.$title.fadeIn("slow");
				} else {
					this.controls.$title.fadeOut("slow");
				}
			}
		},
		
		showMessage: function(html) {
			this.controls.$info.html(html);
			this.controls.$info.fadeIn();
			
			setTimeout($.proxy(function() {this.controls.$info.fadeOut()}, this), 5000);
		},
		
		destroy: function() {
			this.resetHotSpots();
			this.resetHandlers();
			this.resetScene();
		},
		
		util: function() {
			return this._util != null ? this._util : this._util = new Util();
		},
	}
	
	//=============================================
	// Init jQuery Plugin
	//=============================================
	/**
	 * @param CfgOrCmd - config object or command name
	 * @param CmdArgs - some commands may require an argument
	 * List of methods:
	 * $("#panorama").ipanorama("loadscene", {sceneId: "main"})
	 * $("#panorama").ipanorama("loadhotspots", {sceneId: "main", hotSpots: []})
	 * $("#panorama").ipanorama("lookat", {yaw: 0, pitch: 0})
	 * $("#panorama").ipanorama("fullscreen")
	 * $("#panorama").ipanorama("grab")
	 * $("#panorama").ipanorama("instance")
	 * $("#panorama").ipanorama("resize")
	 * $("#panorama").ipanorama("destroy")
	 */
	$.fn.ipanorama = function(CfgOrCmd, CmdArgs) {
		return this.each(function() {
			var container = $(this),
			instance = container.data(ITEM_DATA_NAME),
			options = $.isPlainObject(CfgOrCmd) ? CfgOrCmd : {};
			
			if (CfgOrCmd == "destroy") {
				if (!instance) {
					console.error("Calling 'destroy' method on not initialized instance is forbidden");
					return;
				}
				
				container.removeData(ITEM_DATA_NAME);
				instance.destroy();
				
				return;
			}
			
			if (CfgOrCmd == "loadscene") {
				if (!instance) {
					console.error("Calling 'loadscene' method on not initialized instance is forbidden");
					return;
				}
				
				if(!(CmdArgs && CmdArgs.hasOwnProperty("sceneId"))) {
					console.error("Calling 'loadscene' method without the 'sceneId' parameter is forbidden");
					return;
				}
				
				instance.loadScene(CmdArgs.sceneId);
				
				return;
			}
			
			if (CfgOrCmd == "loadhotspots") {
				if (!instance) {
					console.error("Calling 'loadhotspots' method on not initialized instance is forbidden");
					return;
				}
				
				if(!(CmdArgs && CmdArgs.hasOwnProperty("sceneId") && CmdArgs.hasOwnProperty("hotSpots"))) {
					console.error("Calling 'loadhotspots' method without the 'sceneId' and 'hotSpots' parameter is forbidden");
					return;
				}
				
				instance.loadHotSpots(CmdArgs.sceneId, CmdArgs.hotSpots);
				
				return;
			}
			
			if (CfgOrCmd == "lookat") {
				if (!instance) {
					console.error("Calling 'lookat' method on not initialized instance is forbidden");
					return;
				}
				
				if(!(CmdArgs && CmdArgs.hasOwnProperty("yaw") && CmdArgs.hasOwnProperty("pitch"))) {
					console.error("Calling 'lookat' method without the 'yaw' and 'pitch' parameter is forbidden");
					return;
				}
				
				instance.lookAt(CmdArgs.yaw, CmdArgs.pitch);
				
				return;
			}
			
			if (CfgOrCmd == "resize") {
				if (!instance) {
					console.error("Calling 'resize' method on not initialized instance is forbidden");
					return;
				}
				
				instance.resize();
				
				return;
			}
			
			if (CfgOrCmd == "fullscreen") {
				if (!instance) {
					console.error("Calling 'fullscreen' method on not initialized instance is forbidden");
					return;
				}
				
				instance.toggleFullScreen();
				
				return;
			}
			
			if (CfgOrCmd == "grab") {
				if (!instance) {
					console.error("Calling 'grab' method on not initialized instance is forbidden");
					return;
				}
				
				instance.toggleGrab();
				
				return;
			}
			
			if (CfgOrCmd == "instance") {
				if (!instance) {
					console.error("Calling 'instance' method on not initialized instance is forbidden");
					return;
				}
				
				return instance;
			}
			
			if (instance) {
				var config = $.extend({}, instance.config, options);
				instance.init(container, config);
			} else {
				var config = $.extend({}, iPanorama.prototype.defaults, options);
				instance = new iPanorama(container, config);
				container.data(ITEM_DATA_NAME, instance);
			}
		});
	}
	
})(window.jQuery);