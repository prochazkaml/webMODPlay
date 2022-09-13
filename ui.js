/*
 * MODPlay compiled with:
 * (for modplay.js) emcc modplay.c -o modplay.js -s EXPORTED_FUNCTIONS=_malloc,_free,_InitMOD,_RenderMOD,_JumpMOD -s EXPORTED_RUNTIME_METHODS=ccall -O3 -s BINARYEN_ASYNC_COMPILATION=0 -s SINGLE_FILE
 * -- OR --
 * (for modplay_legacy.js) emcc modplay.c -o modplay_legacy.js -s EXPORTED_FUNCTIONS=_malloc,_free,_InitMOD,_RenderMOD,_JumpMOD -s EXPORTED_RUNTIME_METHODS=ccall -O3
 */

var filedata, audioCtx = null, playernode = null;

var playerstatus = {
	playing: false,
	status: null,
	data: null,
	prerender: null,
	filename: null,
	prerendering: false,
	loading: null
};

var bg = new CanvasRenderer(document.getElementById("canvas_bg"));
var fg = new CanvasRenderer(document.getElementById("canvas_fg"));
var topmenubg = new CanvasRenderer(document.getElementById("canvas_topmenubg"));
var topmenufg = new CanvasRenderer(document.getElementById("canvas_topmenufg"));
var interactive = new CanvasRenderer(document.getElementById("canvas_interactive"));

var load_bg = new CanvasRenderer(document.getElementById("canvas_load_bg"));
var load_fg = new CanvasRenderer(document.getElementById("canvas_load_fg"));

var font = {
	systemwhite: new FontRenderer(largefont, [ 255, 255, 255, 255 ], 0),
	systemblack: new FontRenderer(largefont, [ 0, 0, 0, 255 ], 0),
	sserif: new FontRenderer(smallfont, [ 0, 0, 0, 255 ], 0),
	sserifbold: new FontRenderer(smallfont, [ 0, 0, 0, 255 ], 1),
	sserifboldwhite: new FontRenderer(smallfont, [ 255, 255, 255, 255 ], 1),
	monospace: new FontRenderer(fixedfont, [ 255, 255, 255, 255 ], 0),
	icons: new FontRenderer(buttonicons, [ 0, 0, 0, 255 ], 0)
};

var audiomethod = 1; // 0 = ScriptProcessor (legacy, but works with older browsers/current Safari >:C), 1 = AudioWorkletProcessor (only modern browsers, but runs better)

/*
 * --- MICHAL'S RANT ABOUT THE CHROMIUM & WEBKIT USERAGENT BULLSH*T ---
 * 
 * This site needs to detect whether the user is running a WebKit-based browser or not (see the later part(s) of this rant for more info
 * on why that is necessary). But guess what? ALL CHROMIUM-BASED BROWSERS REPORT THAT THEY ARE RUNNING ON WEBKIT.
 * 
 * And yes, I am very much aware that Chromium is based on WebKit. Or at least it used to be, 9 F*CKING YEARS AGO.
 * Since then, Chromium runs on the Blink engine, so WHY THE F*CK DOES IT STILL REPORT AS IF IT WAS STILL RUNNING WEBKIT??!!?!!!
 * 
 * WHYYYY? SERIOUSLY, WHO THE F*CK THOUGHT THAT THIS WAS A GOOD IDEA? I AM RAGING AND SCREAMING RIGHT NOW,
 * JUST BECAUSE SOME ASSHOLE AT GOOGLE THOUGHT "wOn'T sOmEbOdY pLeAsE tHiNk oF tHe uSeR's pRiVaCy?", AS IF MAKING UP A FAKE USERAGENT
 * HELPED WITH ANYTHING REGARDING PRIVACY. BUT THAT DOESN'T MATTER, BECAUSE THEY DON'T GIVE A SH*T ABOUT USER PRIVACY ANYWAY!!!
 * 
 * For real, what the f*ck is the actual reasoning behind this? Have they not, for a F*CKING SECOND imagined that this change would break sh*t,
 * as the useragent is INDISPENSABLE for detecting compatibility? IF I EVER FIND THIS F*CKING SOYDEV WHO MADE THIS CHANGE TO THE USERAGENT,
 * YOU CAN SURE AS HELL BE SURE THAT I WILL SHOVE A GIANT F*CKING SPIKE STRAIGHT THROUGH THEIR... ok, I'll stop. I'm fine, and I'm calm.
 * 
 * --- THE RANT CONTINUES - APPLE CAN GO F*CK THEMSELVES AS WELL ---
 * 
 * You might ask: "But Michal, *why* do you need to even detect WebKit? What's wrong with it?"
 * 
 * I have been fighting with this website supporting WebKit (which is used in Apple's Safari) for a week. A F*CKING WEEK.
 * And you know why? BECAUSE THE F*CKING DOCUMENTATION LIES! IT JUST STRAIGHT UP F*CKING LIES!!
 * 
 * https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor
 * 
 * It clearly states (as of 13-05-2022) that the AudioWorkletProcessor API is implemented in Safari. Which is, in their defence, somewhat true
 * (I managed to get it working far enough that it was indeed loading the WASM binary and parsing the MOD file correctly),
 * but what they don't tell you that on Safari, IT F*CKING CAUSES THE AUDIO CONTEXT TO HANG FOREVER WITH NO WAY TO RESUME IT.
 * 
 * THAT'S F*CKING RIGHT. IF I ATTACH AN AUDIOWORKLETPROCESSOR TO THE AUDIO CONTEXT, IT JUST F*CKING BREAKS AND NEVER STARTS GENERATING AUDIO! Great.
 * 
 * And of course, at first, I thought that it was simply my own fault, that I have f*cked up the code somehow.
 * So I pulled up the official Google Audio Worklet API examples (https://googlechromelabs.github.io/web-audio-samples/audio-worklet/)
 * on my iPhone, and imagine how surprised I was when I found out that the examples which used the AudioWorkletProcessor exclusively
 * (e.g. the one called "AudioWorkletNode Options") in the same manner as this site, DID NOT F*CKING WORK AT ALL!
 * 
 * It could of course just be Google's fault, as they have already proven themselves completely useless & idiotic (as I have outlined above).
 * But surprisingly, I'm on Google's side on this one, as some libraries which attempt to solve the web audio fragmentation do one interesting thing:
 * 
 *  > [WARNING] The AudioWorklet is accessible as a property of an AudioContext or OfflineAudioContext.
 *    ***It uses the ScriptProcessorNode internally to create an AudioWorkletProcessor in Safari.***
 *    This means it will only provide the performance improvements that you would normally expect from using an AudioWorklet in Chrome, Edge and Firefox.
 * 
 * (from https://github.com/chrisguttandin/standardized-audio-context)
 * 
 * DO YOU KNOW WHAT THAT F*CKING MEANS??? It means that the library just straight up DOES NOT USE THE AUDIOWORKLETPROCESSOR API AND
 * INSTEAD REVERTS TO THE SH*TTY OLD ONE (ScriptProcessorNode) ON SAFARI! But why is it sh*tty? Well, it has one slight issue,
 * and that it runs IN THE MAIN F*CKING BROWSER THREAD, WHICH MEANS THAT IF YOU HAVE AUDIO PLAYING,
 * AS SOON AS YOU START INTERACTING WITH OTHER WEBSITES IN THE SAME BROWSER, THE AUDIO WILL TURN TO SHIIIIITTTT!
 * 
 * So yeah, I have to detect whether the user is running a WebKit based browser. OH WAIT, THAT IS NOT F*CKING POSSIBLE,
 * AS CHROMIUM-BASED BROWSERS (WHICH IS MOST OF THEM - Chrome, Brave, Edge, Opera, Vivaldi etc.) ALSO REPORT THAT THEY ARE WEBKIT-BASED!
 * 
 * But you might think that it would just be easier to search for "Safari" in the user agent and not look for WebKit specifically,
 * as Safari is the only web browser that currently still uses WebKit... right???
 * 
 * --- THE RANT GOES DEEPER - SERIOUSLY, F*CK APPLE ---
 * 
 * If you have an iOS device and tried to download another web browser (other than Safari, that would be Brave, Chrome, Firefox etc.),
 * you might have noticed that they acted a little strange, especially compared to their Android counterparts.
 * 
 * In fact, you might have even observed that all of these browsers feel... kinda same-y.
 * THAT IS BECAUSE THEY ARE ALL JUST SAFARI IN DISGUISE, MEANING THEY ALL RUN ON THE SAME F*CKING WEBKIT ENGINE!
 * 
 * Let's read an excerpt from the Wikipedia article on WebKit:
 * 
 *  > Chrome used only WebCore, and included its own JavaScript engine named V8 and a multiprocess system.
 *    Chrome for iOS continues to use WebKit because ***Apple requires that web browsers on that platform must do so.***
 * 
 * (from https://en.wikipedia.org/wiki/WebKit)
 * 
 * THAT'S F*CKING RIGHT. ALL IOS BROWSERS ARE FORCED TO USE APPLE'S WEBKIT INSTEAD OF THE BROWSER'S NATIVE ENGINE LIKE ON OTHER PLATFORMS,
 * JUST BECAUSE APPLE IS A GREEDY MONOPOLISTIC PILE OF SH*T AND THEY WANT YOU TO ONLY USE THEIR INCOMPLETE SH*TTY ENGINE NO MATTER WHAT!!!
 * 
 * So in the end, the WebKit detection method below only triggers on Apple's iOS devices, as all iOS browsers currently run on WebKit. 
 * Sorry macOS Safari users, all you get is a broken site, thanks to some incredibly stupid decisions made by two of the largest corporations in the world.
 * 
 * Or just do yourself a favour and get Brave or Firefox instead, since on macOS, you have the ***luxury*** to run any browser engine you want.
 * 
 * Thanks for coming to my TED talk.
 * 
 * --- RANT OVER ---
 * (sorry about that, I just had to vent this one out)
 */

if(window.location.search == "?safarioverride") {
	document.getElementById("audioworkletwarn").style.display = "";
} else if(navigator.userAgent.indexOf('iPhone') != -1 ||
    navigator.userAgent.indexOf('iPad') != -1 ||
    navigator.userAgent.indexOf('iPod') != -1) {

	audiomethod = 0;

	document.getElementById("audioworkleterr").style.display = "";
}

if(!audiomethod) {
	var script = document.createElement("script");

	script.src = "modplay_legacy.js";
	script.onload = () => {
		// blablabla
	}

	document.body.appendChild(script);
}

window.requestAnimFrame = (function(){
	return window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		function( callback ){
		  window.setTimeout(callback, 1000 / 60);
		};
})();

function handleMessage(event) {
	switch(event.data.message) {
		case "fail":
			alert("Invalid file!");
			playernode.port.postMessage({ message: "stop" });

			playerstatus.status = null;
			playerstatus.data = null;
			playerstatus.filename = null;

			for(var i = 0; i < 5; i++) {
				buttons[i].enabled = false;
			}
			break;

		case "reset":
			playerstatus.status = null;
			buttons[2].enabled = true;
			
			drawFGOverrideTimeout();
			// break intentionally missing here

		case "stop":
			buttons[3].enabled = false;

			if(playerstatus.status != null) buttons[2].enabled = true;

			drawInteractive();

			playerstatus.playing = false;
			break;

		case "succ":
			playerstatus.data = event.data.data;
			playerstatus.status = event.data.status;
			playerstatus.prerender = null;
			playerstatus.playing = false;

			for(var i = 0; i < 5; i++) {
				buttons[i].enabled = false;
			}
			drawInteractive();

			playerstatus.prerendering = true;
			drawFGOverrideTimeout();

			setTimeout(() => {
				for(var i = 0; i < 5; i++) {
					buttons[i].enabled = true;
				}
	
				// Parse all of the data now, rather than dealing with the headache later
				// Yes, it causes a short pause when a tune is loaded, but it MASSIVELY improves performance

				// Create a temporary canvas with a FontCanvasRenderer

				const buffer32 = playerstatus.status.buffer32;
		
				var prerender = document.createElement('canvas');
				prerender.width = fg.w * 2;
				prerender.height = 13 * 2;

				var pctx = prerender.getContext("2d");

				// Pre-render all of the tracker rows

				const maxrow = buffer32[0] * 64, currow = buffer32[2] * 64 + buffer32[3];

				const notes = [ "C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-" ];
		
				var prerenderarr = [];

				for(var p = 0; p < buffer32[0]; p++) {
					for(var r = 0; r < 64; r++) {
						var w = 14;
		
						pctx.clearRect(0, 0, prerender.width, prerender.height);

						if((r + currow) >= 0 && (r + currow) < maxrow) {
							w += font.monospace.drawString(pctx, ("0" + (p + 1)).slice(-2), w, 0) + 3;
							w += font.monospace.drawString(pctx, ("0" + r).slice(-2), w, 0) + 7;
							
							for(var c = 0; c < 4; c++) {
								var ptr = 1084 + ((playerstatus.data[952 + p] * 64 + r) * 4 + c) * 4;

								if(playerstatus.data[ptr + 0])
									w += font.monospace.drawString(pctx, notes[(playerstatus.data[ptr + 0] - 1) % 12] + Math.floor((playerstatus.data[ptr + 0] - 1) / 12 + 4), w, 0) + 3;
								else
									w += font.monospace.drawString(pctx, "---", w, 0) + 3;
		
								if(playerstatus.data[ptr + 1])
									w += font.monospace.drawString(pctx, ("0" + playerstatus.data[ptr + 1]).slice(-2), w, 0) + 3;
								else
									w += font.monospace.drawString(pctx, "--", w, 0) + 3;
		
								var effect = (playerstatus.data[ptr + 2] << 8) | playerstatus.data[ptr + 3];
		
								if(effect)
									w += font.monospace.drawString(pctx, ("00" + effect.toString(16).toUpperCase()).slice(-3), w, 0) + 3;
								else
									w += font.monospace.drawString(pctx, "---", w, 0) + 3;
			
								w += 4;
							}
						}

						prerenderarr.push(pctx.getImageData(0, 0, prerender.width * 2, 13 * 2));
					}
				}

				playerstatus.prerender = prerenderarr;

				playerstatus.prerendering = false;

				playernode.port.postMessage({ message: "play" });
			}, 50);

			break;

		case "play":
			buttons[2].enabled = false;
			buttons[3].enabled = true;

			drawInteractive();

			playerstatus.playing = true;
			break;

		case "status":
			playerstatus.status = event.data;
			drawFGOverrideTimeout();
			break;
	}
}

function initModule(data) {
	if(audioCtx == null) {
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	}

	if(playernode == null) {
		if(audiomethod) {
			audioCtx.audioWorklet.addModule('modplay.js').then(() => {
				class MessengerWorkletNode extends AudioWorkletNode {
					constructor(context, name, options) {
						super(context, name, options);
						this.port.onmessage = this.handleMessage.bind(this);
					}

					handleMessage(event) { handleMessage(event); }
				}

				playernode = new MessengerWorkletNode(audioCtx, 'modplay_processor', {
					outputChannelCount: [ 2 ],
					processorOptions: {
						audiofreq: audioCtx.sampleRate
					}
				});

				oscillator = new OscillatorNode(audioCtx);
				oscillator.connect(playernode).connect(audioCtx.destination);
				oscillator.start();

				audioCtx.resume();

				playernode.port.postMessage({message: "init", songdata: data});
			});
		} else {
			modplay_legacy.init(audioCtx.sampleRate, 1024);

			playernode = audioCtx.createScriptProcessor(1024, 0, 2);
			playernode.onaudioprocess = modplay_legacy.process;
			playernode.port = {
				postMessage: (message) => {
					setTimeout(() => modplay_legacy.post({
						data: message
					}), 10);
				}
			}

			playernode.connect(audioCtx.destination);
			playernode.port.postMessage({message: "init", songdata: data});
		}
	} else {
		playernode.port.postMessage({message: "init", songdata: data});
	}	
}

function loadLocal() {
	var element = document.createElement("input");

	element.type = "file";
	element.accept = ".mod"

	element.onchange = () => {
		file = element.files[0];

		console.log(file);

		reader = new FileReader();
		reader.onload = function(x) {
			playerstatus.filename = file.name;
			initModule(new Uint8Array(x.target.result));
		}
		reader.readAsArrayBuffer(file);
	};

	element.click();
}

function loadFromLibrary(name) {
	playerstatus.loading = "Loading (establishing connection)...";
	drawFGOverrideTimeout();

	var req = new XMLHttpRequest();
	req.open("GET", "./library/" + name, true);
	req.responseType = "arraybuffer";

	req.onload = (oEvent) => {
		var arrayBuffer = req.response;
		if (arrayBuffer) {
			playerstatus.loading = null;
			playerstatus.filename = name;
			drawInteractive();

			initModule(new Uint8Array(arrayBuffer));
		}
	};

	req.onprogress = (event) => {
		if(event.lengthComputable)
			playerstatus.loading = "Loading (" + Math.round(event.loaded / 1000) + "/" + Math.round(event.total / 1000) + " kB)...";
		else
			playerstatus.loading = "Loading (???/??? kB)...";

		drawFGOverrideTimeout();
	}

	req.send(null);
}

function drawBG() {
	bg.ctx.clearRect(0, 0, bg.w, bg.h);

	// Basic window geometry

	bg.ctx.strokeStyle = "#000000";

	bg.outlineRect(0, 0, bg.w, bg.h);
	bg.outlineRect(0, 0, bg.w, 20);
	bg.outlineRect(0, 0, 20, 20);
	bg.outlineRect(bg.w - 20, 0, 20, 20);

	// Title bar

	bg.ctx.fillStyle = "#0000AA";
	bg.fillRect(20, 1, bg.w - 40, 18);

	// Window body

	bg.ctx.fillStyle = "#C3C7CB";
	bg.fillRect(1, 39, bg.w - 2, bg.h - 40);

	// Menu

	bg.outlineRect(0, 19, bg.w, 20);

	bg.ctx.fillStyle = "#FFFFFF";
	bg.fillRect(1, 20, bg.w - 2, 18);
	
	// Close button

	bg.closeButton(1, 1);

	// Minimize button

	bg.minimizeButton(bg.w - 19, 1);

	// Status bar

	bg.emboss(12, 46, bg.w - 12 * 2, 23);

	// Channel status box

	bg.emboss(12, 75, 95, 13 * 4 + 2);

	// Channel bar box

	bg.emboss(12 + 95 + 10, 75, bg.w - 12 - 95 - 10 - 12, 13 * 4 + 2);

	bg.ctx.fillStyle = "#000000";
	bg.fillRect(13 + 95 + 10, 76, bg.w - 12 - 95 - 10 - 12 - 2, 13 * 4);

	const buttons = [ 12, 71, 130, 189, 248 ];

	// Tracker window box

	var h = 75 + 13 * 4 + 2 + 7;

	bg.emboss(12, h, bg.w - 12 * 2, 13 * 7 + 2);
	bg.fillRect(13, h + 1, bg.w - 12 * 2 - 2, 13 * 7);

	bg.ctx.fillStyle = "#202020";
	bg.fillRect(13 + 40, h + 1, 76, 13 * 7);
	bg.fillRect(13 + 40 + 77 * 2, h + 1, 76, 13 * 7);

	bg.ctx.fillStyle = "rgba(255, 255, 255, .25)";
	bg.fillRect(13, h + 1 + 13 * 3, bg.w - 12 * 2 - 2, 13);
}

var buttons = [
	{ cb: () => { playernode.port.postMessage({ message: "rw" }); } },
	{ cb: () => { playernode.port.postMessage({ message: "ff" }); } },
	{ cb: () => { playernode.port.postMessage({ message: "play" }); } },
	{ cb: () => { playernode.port.postMessage({ message: "stop" }); } },
	{ cb: () => { playernode.port.postMessage({ message: "reset" }); } },
];

var menus = [
	{ name: "File", popup: { options: [
		{ type: "butt", name: "Upload File...", cb: loadLocal },
		{ type: "butt", name: "Select From Library...", cb: selectFromLibrary },
	] } },
	{ name: "Effects", popup: { options: [
		{ type: "butt", name: "(Un)mute Channel 1", cb: () => { if(playernode) playernode.port.postMessage({ message: "mute", ch: 0 }); } },
		{ type: "butt", name: "(Un)mute Channel 2", cb: () => { if(playernode) playernode.port.postMessage({ message: "mute", ch: 1 }); } },
		{ type: "butt", name: "(Un)mute Channel 3", cb: () => { if(playernode) playernode.port.postMessage({ message: "mute", ch: 2 }); } },
		{ type: "butt", name: "(Un)mute Channel 4", cb: () => { if(playernode) playernode.port.postMessage({ message: "mute", ch: 3 }); } },
		{ type: "div" },
		{ type: "butt", name: "Slower Speed", cb: () => { if(playernode) playernode.port.postMessage({ message: "speed", incr:  1 }); } },
		{ type: "butt", name: "Faster Speed", cb: () => { if(playernode) playernode.port.postMessage({ message: "speed", incr: -1 }); } },
	] } },
	{ name: "Help", popup: { options: [
		{ type: "butt", name: "There is no help.", cb: () => {} },
		{ type: "butt", name: "You're on your own.", cb: () => {} },
		{ type: "div" },
		{ type: "butt", name: "About MODPlay...", cb: () => { window.open("https://github.com/prochazkaml/MODPlay", '_blank'); } },
	] } }
];

var menu_selected = -1, prev_menu_selected = -2, cur_menu = null;

// Precalculate the menus (run as a separate function, so that it does not screw with our global ctx)

(() => {
	var w = 9;

	for(var i = 0; i < menus.length; i++) {
		menus[i].w = font.systemblack.strLen(menus[i].name) + 16;
		menus[i].x = w - 8;

		w += menus[i].w;

		var popup_w = 0, popup_h = 0;

		for(var j = 0; j < menus[i].popup.options.length; j++) {
			switch(menus[i].popup.options[j].type) {
				case "butt":
					var pw = font.systemblack.strLen(menus[i].popup.options[j].name);
					if(pw > popup_w) popup_w = pw;

					menus[i].popup.options[j].y = popup_h;
					popup_h += (menus[i].popup.options[j].h = 18);
					break;

				case "div":
					menus[i].popup.options[j].y = popup_h;
					popup_h += (menus[i].popup.options[j].h = 7);
					break;
			}
		}

		menus[i].popup.w = popup_w + 32;
		menus[i].popup.h = popup_h;
	}
})();

function drawMenu() {
	if(menu_selected != prev_menu_selected) {
		topmenufg.ctx.clearRect(0, 0, topmenufg.canvas.width, topmenufg.canvas.height);
		topmenubg.ctx.clearRect(0, 0, topmenubg.canvas.width, topmenubg.canvas.height);

		cur_menu = null;

		for(var i = 0; i < menus.length; i++) {
			if(i == menu_selected) {
				topmenubg.ctx.fillStyle = "#0000AA";
				topmenubg.fillRect(menus[i].x, 20, menus[i].w, 18);
	
				font.systemwhite.drawString(topmenufg.ctx, menus[i].name, menus[i].x + 8, 21);
	
				const x = menus[i].x + 1, y = 38 + 1;
	
				cur_menu = { oldsel: 0, sel: -1, x: x, y: y, w: menus[i].popup.w, h: menus[i].popup.h, options: menus[i].popup.options };
			} else {
				font.systemblack.drawString(topmenufg.ctx, menus[i].name, menus[i].x + 8, 21);
			}
		}
	
		prev_menu_selected = menu_selected;
	}

	if(cur_menu !== null && cur_menu.oldsel != cur_menu.sel) {
	//			topmenubg.ctx.strokeStyle = "#C3C7CB";
	//			topmenubg.outlineRect(x, y, menus[i].popup.w + 2, menus[i].popup.h + 2);
	
		topmenubg.ctx.strokeStyle = "#000000";
		topmenubg.outlineRect(cur_menu.x - 1, cur_menu.y - 1, cur_menu.w + 2, cur_menu.h + 2);

		topmenubg.ctx.fillStyle = "#FFFFFF";
		topmenubg.fillRect(cur_menu.x, cur_menu.y, cur_menu.w, cur_menu.h);

		topmenubg.ctx.fillStyle = "#0000AA";

		for(var j = 0; j < cur_menu.options.length; j++) {
			switch(cur_menu.options[j].type) {
				case "butt":
					if(j == cur_menu.sel) {
						topmenubg.fillRect(cur_menu.x, cur_menu.y + cur_menu.options[j].y, cur_menu.w, cur_menu.options[j].h);
						font.systemwhite.drawString(topmenufg.ctx, cur_menu.options[j].name, cur_menu.x + 16, cur_menu.y + cur_menu.options[j].y);
					} else {
						font.systemblack.drawString(topmenufg.ctx, cur_menu.options[j].name, cur_menu.x + 16, cur_menu.y + cur_menu.options[j].y);
					}
					break;

				case "div":
					topmenufg.horizLine(cur_menu.x, cur_menu.y + cur_menu.options[j].y + 3, cur_menu.w);
					break;
			}	
		}

		cur_menu.oldsel = cur_menu.sel;
	}
}

function drawInteractive() {
	interactive.ctx.clearRect(0, 0, fg.w, fg.h);

	// Window title

	if(playerstatus.filename != null)
		font.systemwhite.drawString(interactive.ctx, "MODPlay - " + playerstatus.filename, bg.w / 2, 2, FontRenderer.ALIGN_CENTER);
	else
		font.systemwhite.drawString(interactive.ctx, "MODPlay", bg.w / 2, 2, FontRenderer.ALIGN_CENTER);

	drawMenu();

	// If the buttons had not been initialized up to now, initialize them

	if(buttons[0].enabled == undefined) {
		const button_margin = 12;
		const button_w = (bg.w - 24 + button_margin) / buttons.length;

		for(var i = 0; i < buttons.length; i++) {
			buttons[i].enabled = false;
			buttons[i].depressed = false;
			buttons[i].x = 12 + Math.floor(button_w * i);
			buttons[i].y = bg.h - 23 - 10;
			buttons[i].w = Math.floor(button_w) - button_margin;
			buttons[i].h = 23;
			buttons[i].u = 12 + Math.floor(button_w * (i + .5) - font.icons.font[i].width / 2 - button_margin / 2);
			buttons[i].v = bg.h - 23 - 10 + 6;
		}
	}

	for(var i = 0; i < buttons.length; i++) {
		if(!buttons[i].depressed) {
			bg.largeButton(buttons[i].x, buttons[i].y, buttons[i].w, buttons[i].h);
			font.icons.drawChar(interactive.ctx, buttons[i].enabled ? i : (i + 5), buttons[i].u, buttons[i].v);
		} else {
			bg.largeDepressedButton(buttons[i].x, buttons[i].y, buttons[i].w, buttons[i].h);
			font.icons.drawChar(interactive.ctx, buttons[i].enabled ? i : (i + 5), buttons[i].u + 2, buttons[i].v + 2);
		}
	}
}

function processMouseEvent(e, click) {
	const rect = interactive.canvas.getBoundingClientRect();

	const x = Math.floor((e.pageX - (rect.left + window.scrollX)) / 2 * (interactive.canvas.width / rect.width));
	const y = Math.floor((e.pageY - (rect.top + window.scrollY)) / 2 * (interactive.canvas.height / rect.height));

//	console.log(click, x, y);

	if(cur_menu != null && (x >= (cur_menu.x - 1) && y >= (cur_menu.y - 1) && x < (cur_menu.x + cur_menu.w + 2) && y < (cur_menu.y + cur_menu.h + 2))) {
		// Top menu popup

		cur_menu.sel = -1;

		for(var i = 0; i < cur_menu.options.length; i++) {
			if(y >= (cur_menu.y + cur_menu.options[i].y) && y < (cur_menu.y + cur_menu.options[i].y + cur_menu.options[i].h)) {
				cur_menu.sel = i;
			}
		}
	} else if(y >= 20 && y < 20 + 18) {
		// Top menu bar
		
		menu_selected = -1;

		for(var i = 0; i < menus.length; i++) {
			if(x >= menus[i].x && x < (menus[i].x + menus[i].w)) {
				menu_selected = i;
			}
		}

		if(click && (prev_menu_selected == menu_selected)) {
			menu_selected = -1;
		}
	} else {
		// Player buttons

		menu_selected = -1;

		for(var i = 0; i < buttons.length; i++) {
			buttons[i].depressed = false;

			if(x >= buttons[i].x && y >= buttons[i].y && x < (buttons[i].x + buttons[i].w) && y < (buttons[i].y + buttons[i].h) && buttons[i].enabled) {
				buttons[i].depressed = true;
			}
		}
	}

	drawInteractive();
}

var mousedown = false, lastX = 0, lastY = 0;

function winMouseMove(e) {
	if(mousedown) processMouseEvent(e);
}

function winMousePress(e) {
	console.log(e);

	mousedown = true;

	processMouseEvent(e, true);
}

function winMouseRelease() {
	mousedown = false;

	console.log("Release");

	for(var i = 0; i < buttons.length; i++) {
		if(buttons[i].depressed) buttons[i].cb();
		buttons[i].depressed = false;
	}

	if(cur_menu !== null && cur_menu.sel != -1 && cur_menu.options[cur_menu.sel].cb) {
		setTimeout(() => {
			cur_menu.options[cur_menu.sel].cb();
			menu_selected = -1;
			drawInteractive();
		}, 50);
	}

	drawInteractive();
}

var librarySelection, loadWinElements;

function loadWinConfirm() {
	for(var i = 2; i < loadWinElements.length; i++) {
		if(loadWinElements[i].depressed) {
			console.log(loadWinElements[i].name);
			loadFromLibrary(loadWinElements[i].name);
			break;
		}
	}

	loadWinClose();
}

function loadWinClose() {
	load_bg.canvas.style.display =
	load_fg.canvas.style.display = "none";

	document.body.style.backgroundColor = "white";
}

function loadWinMouseMove(e) {
	if(mousedown) loadProcessMouseEvent(e, false);
}

function loadWinMousePress(e) {
	console.log(e);

	mousedown = true;

	loadProcessMouseEvent(e);
}

function loadWinMouseRelease() {
	mousedown = false;

	for(var i = 0; i < 2; i++) {
		if(loadWinElements[i].depressed) loadWinElements[i].cb();
		loadWinElements[i].depressed = false;
	}

	var released = window.performance.now();

	for(var i = 2; i < loadWinElements.length; i++) {
		const b = loadWinElements[i];
		if(lastX >= b.x && lastY >= b.y && lastX < (b.x + b.w) && lastY < (b.y + b.h) && b.depressed) {
			if(released - b.released < 1000) loadWinConfirm();

			loadWinElements[i].released = released;
		}
	}

	loadWinRedrawButtons();
}

function loadProcessMouseEvent(e) {
	const rect = load_fg.canvas.getBoundingClientRect();

	const x = Math.floor((e.pageX - (rect.left + window.scrollX)) / 2 * (load_fg.canvas.width / rect.width));
	const y = Math.floor((e.pageY - (rect.top + window.scrollY)) / 2 * (load_fg.canvas.height / rect.height));

	lastX = x; lastY = y;

	for(var i = 0; i < loadWinElements.length; i++) {
		const b = loadWinElements[i];

		if(x >= b.x && y >= b.y && x < (b.x + b.w) && y < (b.y + b.h)) {
			if(i >= 2) for(var j = 2; j < loadWinElements.length; j++) {
				loadWinElements[j].depressed = false;
			}
			
			b.depressed = true;
		} else {
			if(i < 2) b.depressed = false;
		}
	}

	loadWinRedrawButtons();
}

function selectFromLibrary() {
	const w = 280, h = files.length * 16 + 50 + 2;
	const x = (load_bg.w - w) / 2, y = (load_bg.h - h) / 2;

	load_bg.canvas.style.display =
	load_fg.canvas.style.display = "";

	document.body.style.backgroundColor = "#7F7F7F";

	load_bg.ctx.clearRect(0, 0, load_bg.w, load_bg.h);

	load_bg.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
	load_bg.fillRect(0, 0, load_bg.w, load_bg.h);

	// Window body

	load_bg.ctx.strokeStyle = "#000000";
	load_bg.outlineRect(x, y, w, h);

	load_bg.ctx.fillStyle = "#0000AA";
	load_bg.fillRect(x + 1, y + 1, w - 2, h - 2);

	load_bg.ctx.fillStyle = "#FFFFFF";
	load_bg.fillRect(x + 5, y + 5, w - 10, h - 10);

	// Top bar

	load_bg.horizLine(x + 6, y + 6 + 18, w - 12);
	load_bg.vertLine(x + 6 + 18, y + 6, 18);

	load_bg.closeButton(x + 6, y + 6);

	load_bg.ctx.fillStyle = "#0000AA";
	load_bg.fillRect(x + 6 + 19, y + 6, w - 12 - 19, 18);

	// Buttons

	const butt_x = x + w - 88 - 15;

	loadWinElements = [
		{ type: "bigbutt", w: 88, h: 23, x: butt_x, y: y + 35, name: "OK", cb: loadWinConfirm },
		{ type: "bigbutt", w: 88, h: 23, x: butt_x, y: y + 35 + 29, name: "Cancel", cb: loadWinClose },
	];
	
	// File selector

	const sel_x = x + 15, sel_y = y + 35 - 1, sel_w = w - 30 - 88 - 10, sel_h = h - 35 - 15;

	load_bg.outlineRect(sel_x, sel_y, sel_w, sel_h);

	for(var i = 0; i < files.length; i++) {
		loadWinElements[2 + i] = {
			type: "listentry",
			name: files[i],
			x: sel_x + 1,
			y: sel_y + 1 + i * 16,
			w: sel_w - 2,
			h: 16,
			depressed: !i,
			released: null,
		};
	}

	loadWinRedrawButtons();
}

function loadWinRedrawButtons() {
	const w = 280, h = files.length * 16 + 50 + 2;
	const x = (load_bg.w - w) / 2, y = (load_bg.h - h) / 2;

	load_fg.ctx.clearRect(0, 0, load_fg.w, load_fg.h);

	font.systemwhite.drawString(load_fg.ctx, "Select from library", load_fg.w / 2, y + 7, FontRenderer.ALIGN_CENTER);

	for(var i = 0; i < loadWinElements.length; i++) {
		const b = loadWinElements[i];

		switch(b.type) {
			case "bigbutt":
				if(b.depressed) {
					load_bg.largeDepressedButton(b.x, b.y, b.w, b.h);
					font.sserifbold.drawString(load_fg.ctx, b.name, b.x + b.w / 2 + 1, b.y + 6, FontRenderer.ALIGN_CENTER);
				} else {
					load_bg.largeButton(b.x, b.y, b.w, b.h);
					font.sserifbold.drawString(load_fg.ctx, b.name, b.x + b.w / 2, b.y + 5, FontRenderer.ALIGN_CENTER);
				}
				break;

			case "listentry":
				if(b.depressed) {
					load_bg.ctx.fillStyle = "#0000AA";
					load_bg.fillRect(b.x, b.y, b.w, b.h);
					font.sserifboldwhite.drawString(load_fg.ctx, b.name, b.x + 4, b.y + 1);		
				} else {
					load_bg.ctx.fillStyle = "#FFFFFF";
					load_bg.fillRect(b.x, b.y, b.w, b.h);
					font.sserifbold.drawString(load_fg.ctx, b.name, b.x + 4, b.y + 1);		
				}
				break;
		}
	}
}

var bargraphvals = [ 0, 0, 0, 0 ], bargraphtargets = [ 0, 0, 0, 0 ], bargrapholdages = [ Infinity, Infinity, Infinity, Infinity ];

var fgstalling = false, oldtime = null, lastfps = null, fpsmeasurestep = 0, fpsaverage = 0, busyaverage = 0;

function drawFGOverrideTimeout() {
	if(fgstalling) {
		drawFG();
	}
}

function drawFG() {
	fgstalling = null;
	const starttime = window.performance.now();
	
	fg.ctx.clearRect(0, 0, fg.w, fg.h);

	const playing = playerstatus.playing;

	var runnexttime = false;

	if(playerstatus.loading != null) {
		font.sserifbold.drawString(fg.ctx, playerstatus.loading, fg.w / 2, 50, FontRenderer.ALIGN_CENTER);

		bargraphtargets = [ 0, 0, 0, 0 ];
		bargrapholdages = [ Infinity, Infinity, Infinity, Infinity ];
	}
	
	if(playerstatus.prerendering) {
		if(playerstatus.loading == null) font.sserifbold.drawString(fg.ctx, "Pre-rendering texture cache, please wait...", fg.w / 2, 50, FontRenderer.ALIGN_CENTER);

		bargraphtargets = [ 0, 0, 0, 0 ];
		bargrapholdages = [ Infinity, Infinity, Infinity, Infinity ];
	} else if(playerstatus.status == null) {
		if(playerstatus.loading == null) font.sserifbold.drawString(fg.ctx, "Stopped", fg.w / 2, 50, FontRenderer.ALIGN_CENTER);

		bargraphtargets = [ 0, 0, 0, 0 ];
		bargrapholdages = [ Infinity, Infinity, Infinity, Infinity ];
	} else {
		const buffer8 = playerstatus.status.buffer8;
		const buffer16 = playerstatus.status.buffer16;
		const buffer32 = playerstatus.status.buffer32;
		
		if(playerstatus.loading == null) {
			if(!playing) {
				font.sserifbold.drawString(fg.ctx, "Paused - Row: " + ("0" + buffer32[3]).slice(-2) + " Order: " + (buffer32[2] + 1) + "/" + buffer32[0] + " @ Speed " + ("0" + buffer32[5]).slice(-2), fg.w / 2, 50, FontRenderer.ALIGN_CENTER);
			} else {
				font.sserifbold.drawString(fg.ctx, "Playing - Row: " + ("0" + buffer32[3]).slice(-2) + " Order: " + (buffer32[2] + 1) + "/" + buffer32[0] + " @ Speed " + ("0" + buffer32[5]).slice(-2), fg.w / 2, 50, FontRenderer.ALIGN_CENTER);
			}
		}

		if(playerstatus.prerender != null) {
			var h = 75 + 13 * 4 + 2 + 7;

			for(var r = -3; r <= 3; r++) {
				var currow = buffer32[3] + buffer32[2] * 64 + r;

				if(currow >= 0 && currow < playerstatus.prerender.length)
					fg.ctx.putImageData(playerstatus.prerender[currow], 0, h * 2);

				h += 13;
			}

			fg.ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
			fg.ctx.fillRect(14, 75 + 13 * 4 + 2 + 7, fg.w - 28, 13 * 3);
			fg.ctx.fillRect(14, 75 + 13 * 4 + 2 + 7 + 13 * 4, fg.w - 28, 13 * 3);
		} else {
			bargraphvals[i] = 0;
		}

		for(var i = 0; i < 4; i++) {
			if(playing) {
				if(buffer8[748 + 19 + i * 20]) {
					// Muted

					bargraphtargets[i] = 0;

	//				document.getElementById("mute" + i).disabled = true;
	//				document.getElementById("unmute" + i).disabled = false;
				} else {
					// Unmuted

					bargraphtargets[i] = buffer8[748 + 18 + i * 20];

					if(buffer32[187 + 1 + i * 5] < bargrapholdages[i])
						bargraphtargets[i] = buffer8[748 + 18 + i * 20] * 1.5;

					bargrapholdages[i] = buffer32[187 + 1 + i * 5];

					if(buffer16[374 + 8 + i * 10] == 0) bargraphtargets[i] = 0;
				
					if(bargraphvals[i] < bargraphtargets[i]) bargraphvals[i] = bargraphtargets[i];

	//				document.getElementById("mute" + i).disabled = false;
	//				document.getElementById("unmute" + i).disabled = true;

					runnexttime = true;
				}
			} else {
				bargraphtargets[i] = 0;
			}

			if(!buffer8[748 + 19 + i * 20])
				font.sserif.drawString(fg.ctx, [">", "<", "<", ">"][i] + " CH " + (i + 1) + " " +
					("000" + (buffer16[374 + 8 + i * 10] + (buffer32[45 + i * 2] >> 7))).slice(-4) + " " + 
					("0" + (buffer8[748 + 18 + i * 20] + (buffer32[53 + i * 2] >> 6))).slice(-2) + " " +
					("0" + (buffer32[21 + i] + 1)).slice(-2) + " ",
					14, 76 + i * 13);
			else
				font.sserif.drawString(fg.ctx, [">", "<", "<", ">"][i] + " CH " + (i + 1) + " MUTED", 14, 76 + i * 13);
		}
	}

	// Draw the channel bars
	
	const steps = bg.w - 12 - 95 - 10 - 12 - 4;

	for(var i = 0; i < 4; i++) {
		for(var x = 0; x < steps; x += 2) {
			if(x < steps / 4 * 3) {
				fg.ctx.strokeStyle = "#00FF00";
			} else if(x < steps / 8 * 7) {
				fg.ctx.strokeStyle = "#FFFF00";
			} else {
				fg.ctx.strokeStyle = "#FF0000";
			}

			if(bargraphvals[i] > x / (steps / 96))
				fg.vertLine(14 + 95 + 10 + x, 78 + i * 13, 9)
			else
				break;
		}

		if(bargraphvals[i] > bargraphtargets[i]) {
			runnexttime = true;

			bargraphvals[i] -= 1.5;

			if(bargraphvals[i] < bargraphtargets[i]) bargraphvals[i] = bargraphtargets[i];
		}
	}

	// Depending on the UI state, pause for 16.66667 ms (1 frame) or forever

	if(!runnexttime) {
		oldtime = null, lastfps = null, fpsmeasurestep = 0, fpsaverage = 0, busyaverage = 0;
		
		fgstalling = true;
	} else {
		// Sleep, so that the whole thing runs at ~60 fps

		busyaverage += (window.performance.now() - starttime) / 16.66667;
	
		requestAnimFrame(drawFG);
	
		if(oldtime != null) {
			fpsaverage += 1000 / (starttime - oldtime);
	
			if(++fpsmeasurestep == 10) {
				lastfps = (fpsaverage / 10).toFixed(1) + " fps (UI " + (busyaverage / 10 * 100).toFixed(0) + " % busy)";
	
				fpsmeasurestep = 0;
				fpsaverage = 0;
				busyaverage = 0;
			}
		}

		if(lastfps != null) {
			font.systemblack.drawString(fg.ctx, lastfps, fg.w - 9, 21, FontRenderer.ALIGN_RIGHT);
		} else {
			font.systemblack.drawString(fg.ctx, "Staring profiler, hang on...", fg.w - 9, 21, FontRenderer.ALIGN_RIGHT);
		}

		oldtime = starttime;
	}
}

drawFG();
drawBG();
drawInteractive();

var touchesdetected = false;

function mouseEventAbstractor(e, fn) {
	if(!touchesdetected) fn(e);
}

interactive.canvas.addEventListener("mousemove", (e) => { mouseEventAbstractor(e, winMouseMove); });
interactive.canvas.addEventListener("mousedown", (e) => { mouseEventAbstractor(e, winMousePress); });
interactive.canvas.addEventListener("mouseup", (e) => { mouseEventAbstractor(e, winMouseRelease); });

load_fg.canvas.addEventListener("mousemove", (e) => { mouseEventAbstractor(e, loadWinMouseMove); });
load_fg.canvas.addEventListener("mousedown", (e) => { mouseEventAbstractor(e, loadWinMousePress); });
load_fg.canvas.addEventListener("mouseup", (e) => { mouseEventAbstractor(e, loadWinMouseRelease); });

function touchEventAbstractor(e, fn) {
	touchesdetected = true;
	fn(e.touches[0]);
}

interactive.canvas.addEventListener("touchmove", (e) => { touchEventAbstractor(e, winMouseMove); });
interactive.canvas.addEventListener("touchstart", (e) => { touchEventAbstractor(e, winMousePress); });
interactive.canvas.addEventListener("touchend", (e) => { touchEventAbstractor(e, winMouseRelease); });

load_fg.canvas.addEventListener("touchmove", (e) => { touchEventAbstractor(e, loadWinMouseMove); });
load_fg.canvas.addEventListener("touchstart", (e) => { touchEventAbstractor(e, loadWinMousePress); });
load_fg.canvas.addEventListener("touchend", (e) => { touchEventAbstractor(e, loadWinMouseRelease); });
