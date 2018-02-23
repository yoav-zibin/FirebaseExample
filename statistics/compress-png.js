const imagemin = require('imagemin');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');

imagemin(["taki.png"], 'compressed/', {
	plugins: [
		imageminJpegtran(),
		imageminPngquant({quality: '65-80'})
	]
}).then(files => {
	console.log(files);
	//=> [{data: <Buffer 89 50 4e …>, path: 'build/images/foo.jpg'}, …]
});

/*
const Jimp = require("jimp");

return Jimp.read("taki.png").then((img) =>{
  return img.write("taki-compressed.png");
}).catch((err) =>{
  console.error("error=" + err);
});
*/