import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

/** Server bootstrap used by the prerenderer; the BootstrapContext is required on Angular 22. */
const bootstrap = (context: BootstrapContext): ReturnType<typeof bootstrapApplication> =>
  bootstrapApplication(App, config, context);

export default bootstrap;
