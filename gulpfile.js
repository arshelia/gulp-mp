const gulp = require("gulp");
const sass = require("gulp-sass");
const rename = require("gulp-rename");
const imagemin = require("gulp-imagemin");
const del = require("del");
const replace = require("gulp-replace");
const postcss = require("gulp-postcss");
const autoprefixer = require("autoprefixer");
const plumber = require("gulp-plumber");
const tap = require("gulp-tap");
const path = require("path");
const notify = require("gulp-notify");
const yargs = require("yargs");

const srcPath = "./src/**";
const distPath = "./dist/";
//存放variable和mixin的sass文件在被引用时直接导入，不引入dist目录中
const DIRECTIMPORT = ["/scss/", "/font/"];
const onError = function(err) {
  notify.onError({
    title: "Gulp",
    subtitle: "Failure!",
    message: "Error: <%= error.message %>",
    sound: "Beep"
  })(err);

  this.emit("end");
};

const wxmlFiles = [`${srcPath}/*.wxml`];
const sassFiles = [`${srcPath}/*.{scss, wxss}`];
const jsFiles = [`${srcPath}/*.js`, `!${srcPath}/env/*.js`];
const jsonFiles = [`${srcPath}/*.json`];
const imageFiles = [
  `${srcPath}/images/*.{png,jpg,gif,ico}`,
  `${srcPath}/images/**/*.{png,jpg,gif,ico}`
];

/* 清除dist目录 */
gulp.task("clean", done => {
  del.sync(["dist/**"]);
  done();
});

const wxml = () => {
  return gulp
    .src(wxmlFiles, { since: gulp.lastRun(wxml) })
    .pipe(gulp.dest(distPath));
};
gulp.task(wxml);

const js = () => {
  return gulp
    .src(jsFiles, { since: gulp.lastRun(js) })
    .pipe(gulp.dest(distPath));
};
gulp.task(js);

const envJs = env => {
  return () => {
    return gulp
      .src(`./src/env/${env}.js`)
      .pipe(rename("env.js"))
      .pipe(gulp.dest(distPath));
  };
};
gulp.task(envJs);

gulp.task("devEnv", envJs("dev"));
gulp.task("testEnv", envJs("tes"));
gulp.task("prodEnv", envJs("prod"));

const json = () => {
  return gulp
    .src(jsonFiles, { since: gulp.lastRun(json) })
    .pipe(gulp.dest(distPath));
};
gulp.task(json);

const wxss = () => {
  return gulp
    .src([...sassFiles, ...DIRECTIMPORT.map(item => `!${srcPath}/${item}/*`)], {
      since: gulp.lastRun(wxss)
    })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(
      tap(file => {
        const filePath = path.dirname(file.path);
        //console.log("filepath", filePath);
        file.contents = new Buffer(
          String(file.contents).replace(
            /@import\s+['|"](.+)['|"];/g,
            ($1, $2) => {
              // console.log("$1", $1);
              // console.log("$2", $2);
              return DIRECTIMPORT.some(item => {
                return $2.indexOf(item) > -1;
              })
                ? $1
                : `/** ${$1} **/`;
            }
          )
        );
      })
    )
    .pipe(sass())
    .pipe(postcss([autoprefixer(["iOS >= 8", "Android >= 4.1"])]))
    .pipe(
      replace(/(\/\*\*\s{0,})(@.+)(\s{0,}\*\*\/)/g, ($1, $2, $3) => {
        //console.log("$1", $1);
        //console.log("$2", $2);
        //console.log("$3", $3);
        return $3.replace(/\.scss/g, ".wxss");
      })
    )
    .pipe(rename({ extname: ".wxss" }))
    .pipe(gulp.dest(distPath));
};
gulp.task(wxss);

const img = () => {
  return gulp
    .src(imageFiles, { since: gulp.lastRun(img) })
    .pipe(imagemin())
    .pipe(gulp.dest(distPath));
};
gulp.task(img);

const newfile = () => {
  yargs
    .example("gulp newfile  -p mypage", "创建mypage的page目录")
    .example("gulp newfile  -c mycomponent", "创建mycomponent的component目录")
    .example(
      "gulp newfile  -s srcfile -p mypage",
      "以srcfile为模版创建mypage的page目录"
    )
    .option({
      s: {
        alias: "src",
        describe: "模板",
        type: "string",
        default: "template"
      },
      p: {
        alias: "page",
        describe: "page名称",
        type: "string"
      },
      c: {
        alias: "component",
        describe: "component名称",
        type: "string"
      }
    })
    .fail(msg => {
      console.error("创建失败");
      console.log(msg);
      console.log("help");
      yargs.parse(["--msg"]);
    })
    .help("msg");

  const args = yargs.argv;
  //console.log("args", args);
  const source = args.s;
  const filePaths = {
    p: "pages",
    c: "components"
  };

  let name, type;
  for (let key in filePaths) {
    if (args[key]) {
      name = args[key];
      type = filePaths[key];
    }
  }
  const defaultPath =
    source === "template"
      ? `src/${source}/${type}/*`
      : `src/${type}/${source}/*`;
  return gulp.src(defaultPath).pipe(gulp.dest(`src/${type}/${name}/`));
};
gulp.task(newfile);

gulp.task("watch", () => {
  const watchSassFiles = [
    ...sassFiles,
    ...DIRECTIMPORT.map(item => `!${srcPath}/${item}/**/*`)
  ];
  gulp.watch(watchSassFiles, wxss);
  gulp.watch(jsFiles, js);
  gulp.watch(jsonFiles, json);
  gulp.watch(imageFiles, img);
  gulp.watch(wxmlFiles, wxml);
});

gulp.task(
  "build",
  gulp.series(
    "clean",
    gulp.parallel("wxml", "js", "json", "wxss", "img", "prodEnv")
  )
);
gulp.task(
  "dev",
  gulp.series(
    "clean",
    gulp.parallel("wxml", "js", "json", "wxss", "img", "devEnv"),
    "watch"
  )
);
gulp.task(
  "test",
  gulp.series(
    "clean",
    gulp.parallel("wxml", "js", "json", "wxss", "img", "testEnv")
  )
);
