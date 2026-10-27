import { defineConfig } from 'vite';

// Hub-en ligger i roten på thomasaitest.github.io.
export default defineConfig({ base: '/', build: { target: 'es2020' } });
