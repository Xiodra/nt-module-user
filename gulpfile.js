const gulp = require('gulp');
const sequence = require('gulp-sequence');
const sourcemaps = require('gulp-sourcemaps');
const ts = require('gulp-typescript');
const tslint = require('gulp-tslint');

const packages = {
    "module-user": ts.createProject("src/tsconfig.json"),
};

const dist = "package";
const modules = Object.keys(packages);

modules.forEach(module => {
    gulp.task(module, () => {
        gulp.src([
            'src/**/*.types.graphql',
        ]).pipe(gulp.dest(dist));

        return packages[module]
            .src()
            .pipe(tslint({
                formatter: "verbose",
            }))
            .pipe(tslint.report({
                emitError: false,
                summarizeFailureOutput: true,
            }))
            .pipe(sourcemaps.init())
            .pipe(packages[module]())
            .pipe(sourcemaps.write("."))
            .pipe(gulp.dest(dist));
    });
});

gulp.task('copy-i18n', function () {
    return gulp.src('src/i18n/*')
        .pipe(gulp.dest(dist + '/i18n'))
});

gulp.task('copy-docs', function () {
    return gulp.src(['README.md', 'README_zh.md'])
        .pipe(gulp.dest(dist))
});

gulp.task('copy-license', function () {
    return gulp.src('LICENSE')
        .pipe(gulp.dest(dist))
});

gulp.task("build", sequence("module-user", 'copy-i18n', 'copy-docs', 'copy-license'));