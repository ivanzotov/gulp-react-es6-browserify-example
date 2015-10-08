import gulp from 'gulp';
import fs from 'fs';
import del from 'del';
import gulpif from 'gulp-if';
import streamify from 'gulp-streamify';
import gutil from 'gulp-util';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import browserify from 'browserify';
import sourcemaps from 'gulp-sourcemaps';
let browserSync = require('browser-sync').create();

let debug, watch = false;
gulp.task('mode:debug', () => debug = true);
gulp.task('mode:watch', () => {
  watch = true;
  browserSync.init({proxy: "localhost:3000"});
});

let log = (msg) => gutil.log(gutil.colors.green(msg));

let img_dest = './public/images/',
    js_filename = 'application.js',
    js_dest = './public/javascripts/',
    css_filename = 'application.css',
    css_dest = './public/stylesheets/',
    html_filename = 'index.html',
    html_dest = './public/',
    images_watch = 'jpg,jpeg,png,gif,svg';

gulp.task('clean:html', () => del.sync([html_dest+html_filename], {force: true}));

gulp.task('clean:js', () => del.sync([js_dest], {force: true}));

gulp.task('clean:css', () => del.sync([css_dest], {force: true}));

gulp.task('clean:images', () => del.sync([img_dest], {force: true}));

gulp.task('clean', ['clean:html', 'clean:js', 'clean:css', 'clean:images']);

gulp.task('precompile', ['clean:html'], cb => {
  let App = require('./components/app'),
      React = require('react'),
      ReactDOM = require('react-dom/server'),
      htmlmin = require('gulp-htmlmin');

  let stream = source(html_filename);
  stream.end(`<!DOCTYPE html>${ReactDOM.renderToStaticMarkup(React.createElement(App))}`);
  stream.pipe(streamify(gulpif(!debug, htmlmin({collapseWhitespace: true}))))
        .pipe(gulp.dest(html_dest));

  log(`Destination HTML file written ${html_dest}${html_filename}`);

  cb(null);
});

gulp.task('img:build', ['clean:images'], cb => {
  gulp.src([`./components/**/*.{${images_watch}}`])
    .pipe(gulp.dest(img_dest))

  log(`Images moved to ${img_dest} folder`);

  cb(null);
});

gulp.task('js:build', ['clean:js'], cb => {
  let watchify = require('watchify'),
      uglify = require('gulp-uglify');

  let browserifyOpts = {debug: debug, entries: 'app.js', extensions: ['.js']};
  let opts = Object.assign({}, watchify.args, browserifyOpts);
  let b = watch ? watchify(browserify(opts)) : browserify(opts);

  let bundle = () => {
    b.bundle()
    .on('error', gutil.log.bind(gutil, 'Browserify Error'))
    .pipe(source(js_filename))
    .pipe(buffer())
    .pipe(gulpif(debug, sourcemaps.init()))
    .pipe(streamify(gulpif(!debug, uglify())))
    .pipe(gulpif(debug, sourcemaps.write()))
    .pipe(gulp.dest(js_dest))
    .pipe(gulpif(watch, browserSync.stream()));

    log(`Javascript files prepared and written to ${js_dest}${js_filename}`);
  }

  bundle();

  if (watch) {
    b.on('update', bundle);
    b.on('log', gutil.log);
  } else {
    cb(null);
  }
});

gulp.task('js:watch', ['mode:debug', 'mode:watch', 'js:build']);

gulp.task('css:build', ['clean:css'], cb => {
  let postcss = require('gulp-postcss'),
      syntax = require('postcss-scss'),
      autoprefixer = require('autoprefixer'),
      sass = require('gulp-sass'),
      concat = require('gulp-concat'),
      minify = require('gulp-minify-css');

  let processors = [
    autoprefixer({ browsers: ['last 2 versions'] })
  ];

  gulp.src(['./components/**/*.{css,scss}'])
    .pipe(gulpif(debug, sourcemaps.init()))
    .pipe(postcss(processors, {syntax: syntax}))
    .pipe(concat(css_filename))
    .pipe(sass({indentedSyntax: false, errLogToConsole: true}))
    .pipe(gulpif(!debug, minify()))
    .pipe(gulpif(debug, sourcemaps.write()))
    .pipe(gulp.dest(css_dest))
    .pipe(browserSync.stream());

  log(`CSS files processed and concatenated to ${css_dest}${css_filename}`);

  cb(null);
});

gulp.task('css:watch', ['mode:debug', 'mode:watch'], () =>
  gulp.watch('./components/**/*.{css,scss}', ['css:build'])
);

gulp.task('watch', ['mode:debug', 'mode:watch', 'compile', 'css:watch', 'js:watch']);

gulp.task('compile', ['clean', 'precompile', 'img:build', 'js:build', 'css:build']);

gulp.task('debug', ['mode:debug', 'compile']);

gulp.task('default', ['watch']);
