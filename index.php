<!DOCTYPE html>
<html lang="cs">
	<head>
		<meta charset="UTF-8">
		<style>
			html, body {
				margin: 0;
				width: 100%;
				height: 100%;
			}

			body {
				display: flex;
				align-items: center;
				justify-content: center;
				background-color: white;
				flex-direction: column;

				font-family: sans-serif;
				text-align: justify;
			}

			.canvasstack {
				margin: 0 auto;

				position: relative;

				max-width: 100%;
				width: 744px;
				aspect-ratio: 744 / 600;
				background-color: white;

				user-select: none;
			}

			.canvaswrapper {
				position: absolute;
				left: 0;
				top: 0;
				width: 744px;
				height: 600px;

				display: flex;
				justify-content: center;
				align-items: center;
			}
		</style>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>MODPlay Demo</title>
		<script src="assets.js"></script>
		<script>
			const files = [
				<?php
					foreach(scandir("./library/") as $file) {
						if(is_file("./library/" . $file) && strtolower(substr($file, -4) == ".mod")) echo("\"$file\",\n");
					}
				?>
			];
		</script>
	</head>	
	<body>
		<div class="canvasstack">
			<div class="canvaswrapper"><canvas id="canvas_bg" width="744" height="538" style="z-index: 0"></canvas></div>
			<div class="canvaswrapper"><canvas id="canvas_fg" width="744" height="538" style="z-index: 1"></canvas></div>
			<div class="canvaswrapper"><canvas id="canvas_topmenubg" width="744" height="538" style="z-index: 2"></canvas></div>
			<div class="canvaswrapper"><canvas id="canvas_topmenufg" width="744" height="538" style="z-index: 3"></canvas></div>
			<div class="canvaswrapper"><canvas id="canvas_interactive" width="744" height="538" style="z-index: 4"></canvas></div>

			<div class="canvaswrapper"><canvas id="canvas_load_bg" width="744" height="600" style="z-index: 5; display: none"></canvas></div>
			<div class="canvaswrapper"><canvas id="canvas_load_fg" width="744" height="600" style="z-index: 6; display: none"></canvas></div>
		</div>

		<div id="audioworkleterr" style="display: none; max-width: 744px;">
			<p>
				I've detected that you're trying to use me on Safari (or any other WebKit-based browser),
				which (at the time of creating this site) does not support the latest standard for web audio.
				That is why the old standard is used instead, which is worse (it has the capability of making your entire browser lag),
				but it is the only one that works on Safari correctly. Apologies for the inconvenience.
			</p>
			<p><a href="./?safarioverride">
				Click here to load this site with the latest standard for web audio anyway,
				in case Safari already supports it and my author just forgot to update me.
			</a></p>
		</div>

		<div id="audioworkletwarn" style="display: none; max-width: 744px;">
			<p>
				This site was loaded in Safari experimental mode, which will attempt to generate audio using the new standard.
			</p>
			<p><a href="./">If it doesn't work (I told you so!), click here to go back.</a></p>
		</div>

		<script src="canvas.js"></script>
		<script src="ui.js"></script>
	</body>
</html>
