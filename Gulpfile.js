/**
 * Dynamically defines develop/test/build/deploy tasks for the current project
 * based on metadata present in package.json.
 */
import _log from 'fancy-log';
import _fs from 'fs';
import _gulp from 'gulp';
import { Project, getTaskFactory } from '@vamship/build-utils';

const _package = JSON.parse(_fs.readFileSync('./package.json', 'utf-8'));
const project = new Project(_package);

_log.info(`Initializing tasks for project: ${project.banner}`);
const factory = getTaskFactory(project);
factory.createTasks().forEach((task) => _gulp.task(task));
