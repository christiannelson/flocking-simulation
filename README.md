# Flocking Simulation

A modern, modular JavaScript simulation of starling flocking (murmuration) using Three.js, GLSL shaders, and ES modules. Shaders are organized in separate `.glsl` files and the project is bundled with Rollup.

This is a fork and upgrade of [techcentaur](https://github.com/techcentaur/Flocking-Simulation). Specifically, this fork eliminates unused code, adds some new options, upgrades the three library, and is packaged as a modern minified package. Thank you to the original authors!

## View a Demo
   ```sh
   open index.html
   ```

## Using the component

   ```js
	const sim = new Starlings('#container');
	sim.start();
   ```

## Options

| Option           | Default     | Description                                                        |
|------------------|-------------|--------------------------------------------------------------------|
| resolution       | 32          | Grid resolution (birds per side, total birds = resolution² if `birds` not set) |
| birds            | null        | If set, overrides resolution to specify total bird count directly   |
| separation       | 20.0        | Distance for separation behavior (avoid crowding neighbors)         |
| alignment        | 30.0        | Distance for alignment behavior (match velocity with neighbors)     |
| cohesion         | 20.0        | Distance for cohesion behavior (move toward average position of neighbors) |
| freedom          | 0.3         | Degree of randomness/freedom in bird movement                      |
| bounds           | 500         | Size of the simulation bounding box                                |
| backgroundColor  | '#fff'      | Background color of the scene                                      |
| birdColor        | '#ccc'      | Color of the birds                                                 |

## Features
- GPU-accelerated flocking simulation with customizable bird count and color.
- Modern ES module imports for Three.js and controls.
- All shaders extracted to `shaders/` as `.glsl` files.
- Clean, maintainable structure with Rollup bundling.

## Credits
- Original concept and much of the code by [techcentaur](https://github.com/techcentaur/Flocking-Simulation) and contributors.
- Inspired by [OwenMcNaughton's Boids.js](https://github.com/OwenMcNaughton/Boids.js) and the Three.js community.

Thanks to all original authors and open source contributors for making this project possible!

## Informational Documents

- [Mathematical model of flocking behavior](http://www.diva-portal.org/smash/get/diva2:561907/FULLTEXT03.pdf)
- [Boids-algorithm - Pseudocode](http://www.kfish.org/boids/pseudocode.html)
- [Research Paper - Craig Reynold's simulation](http://www.csc.kth.se/utbildning/kandidatexjobb/datateknik/2011/rapport/erneholm_carl-oscar_K11044.pdf)

## A Useful Container
- Overleaf LaTex editor - mathematical modeling, click [here](https://www.overleaf.com/15649991qxqnpwqzxvjr)
- A [video](https://www.youtube.com/watch?v=b8eZJnbDHIg) of falcon attack on flock of starling.