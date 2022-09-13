class CanvasRenderer {
	// This class consolidates many common routines for drawing to canvases (including Windows 3.1 elements).
	
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = this.canvas.getContext("2d");

		this.ctx.scale(2, 2);

		this.w = this.canvas.width / 2;
		this.h = this.canvas.height / 2;
	}

	outlineRect(x, y, w, h) {
		this.ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
	}
	
	fillRect(x, y, w, h) {
		this.ctx.fillRect(x, y, w, h);
	}
	
	horizLine(x, y, l) {
		this.ctx.beginPath();
		this.ctx.moveTo(x, y + .5);
		this.ctx.lineTo(x + l, y + .5);
		this.ctx.stroke();
	}
	
	vertLine(x, y, l) {
		this.ctx.beginPath();
		this.ctx.moveTo(x + .5, y);
		this.ctx.lineTo(x + .5, y + l);
		this.ctx.stroke();
	}

	smallButton(x, y, w, h) {
		this.ctx.fillStyle = "#C3C7CB";
		this.fillRect(x, y, w, h);
	
		this.ctx.fillStyle = "#868A8E";
		this.fillRect(x, y + h - 2, w, 2);
		this.fillRect(x + w - 2, y, 2, h);
	
		this.ctx.fillStyle = "#FFFFFF";
		this.fillRect(x, y, w - 1, 1);
		this.fillRect(x, y, 1, h - 1);
	}

	closeButton(x, y) {
		this.ctx.strokeStyle = "#000000";

		this.ctx.fillStyle = "#C3C7CB";
		this.fillRect(x, y, 18, 18);

		this.ctx.fillStyle = "#868A8E";
		this.fillRect(x + 3, y + 8, 13, 3);

		this.ctx.fillStyle = "#FFFFFF";
		this.fillRect(x + 3, y + 8, 11, 1);

		this.outlineRect(x + 2, y + 7, 13, 3);
	}

	minimizeButton(x, y) {
		this.smallButton(x, y, 18, 18);

		this.ctx.fillStyle = "#000000";
		this.fillRect(x + 5, y + 7, 7, 1);
		this.fillRect(x + 6, y + 8, 5, 1);
		this.fillRect(x + 7, y + 9, 3, 1);
		this.fillRect(x + 8, y + 10, 1, 1);
	}

	largeButton(x, y, w, h) {
		this.ctx.strokeStyle = "#000000";
		this.horizLine(x + 1, y, w - 2);
		this.vertLine(x, y + 1, h - 2);

		this.horizLine(x + 1, y + h - 1, w - 2);
		this.vertLine(x + w - 1, y + 1, h - 2);

		this.ctx.fillStyle = "#FFFFFF";
		this.fillRect(x + 1, y + 1, w - 2, h - 2);

		this.ctx.fillStyle = "#868A8E";
		this.fillRect(x + 3, y + 3, w - 4, h - 4);

		this.fillRect(x + 2, y + h - 2, 1, 1);
		this.fillRect(x + w - 2, y + 2, 1, 1);

		this.ctx.fillStyle = "#C3C7CB";
		this.fillRect(x + 3, y + 3, w - 6, h - 6);
	}

	largeDepressedButton(x, y, w, h) {
		// Who's more depressed: this button or me writing this text at 4 AM?

		this.ctx.strokeStyle = "#000000";
		this.horizLine(x + 1, y, w - 2);
		this.vertLine(x, y + 1, h - 2);

		this.horizLine(x + 1, y + h - 1, w - 2);
		this.vertLine(x + w - 1, y + 1, h - 2);

		this.ctx.fillStyle = "#868A8E";
		this.fillRect(x + 1, y + 1, w - 2, h - 2);

		this.ctx.fillStyle = "#C3C7CB";
		this.fillRect(x + 2, y + 2, w - 3, h - 3);
	}
	
	emboss(x, y, w, h) {
		this.ctx.strokeStyle = "#868A8E";
		this.horizLine(x, y, w);
		this.vertLine(x, y, h);
	
		this.ctx.strokeStyle = "#FFFFFF";
		this.vertLine(x + w - 1, y + 1, h - 1);
		this.horizLine(x + 1, y + h - 1, w - 1);
	}	
};

class FontRenderer {
	// A class for rendering text to canvases with fonts converted from Windows 3.1.

	static ALIGN_LEFT = 0;
	static ALIGN_CENTER = 1;
	static ALIGN_RIGHT = 2;
	
	constructor(font, fgcolor, bold) {
		// Internal functions used for pre-rendering the font

		const _plotPixel = (data, x, y, color) => {
			_plotPhysicalPixel(data, x * 2, y * 2, color);
			_plotPhysicalPixel(data, x * 2 + 1, y * 2, color);
			_plotPhysicalPixel(data, x * 2, y * 2 + 1, color);
			_plotPhysicalPixel(data, x * 2 + 1, y * 2 + 1, color);
		}
	
		const _plotPhysicalPixel = (data, x, y, color) => {
			data.data[0 + (x + y * data.width) * 4] = color[0];
			data.data[1 + (x + y * data.width) * 4] = color[1];
			data.data[2 + (x + y * data.width) * 4] = color[2];
			data.data[3 + (x + y * data.width) * 4] = color[3];
		}
	
		this.font = [];

		var ctx = document.createElement('canvas').getContext("2d");
	
		// Pre-render the font

		for(var c = 0; c < font.length; c++) {
			const w = bold ? (font[c][0] + 1) : font[c][0];

			if(font[c][0]) {
				const h = Math.floor(font[c][1].length / font[c][0]);

				var data = ctx.createImageData(w * 2, h * 2); 

				for(var y = 0; y < h; y++) {
					for(var x = 0; x < font[c][0]; x++) {
						if(font[c][1][x + y * font[c][0]] == "x") {
							_plotPixel(data, x, y, fgcolor);
							if(bold) _plotPixel(data, x + 1, y, fgcolor);
						}
					}
				}

				this.font.push({
					width: w,
					height: h,
					data: data
				});
			} else {
				this.font.push({ width: 0, height: 0 });
			}
		}
	}

	drawChar(ctx, c, x, y) {
		ctx.putImageData(this.font[c].data, x * 2, y * 2);

		return this.font[c].width;
	}

	strLen(s) {
		var x = 0;
	
		for(var i = 0; i < s.length; i++) {
			x += this.font[s.charCodeAt(i)].width;
		}
	
		return x;
	}
	
	drawString(ctx, s, x, y, o = FontRenderer.ALIGN_LEFT) {
		switch(o) {
			case FontRenderer.ALIGN_CENTER:
				x -= this.strLen(s) / 2;
				break;
	
			case FontRenderer.ALIGN_RIGHT:
				x -= this.strLen(s);
				break;
		}
	
		var w = 0;
	
		for(var i = 0; i < s.length; i++) {
			w += this.drawChar(ctx, s.charCodeAt(i), x + w, y);
		}
	
		return w;
	}
}
