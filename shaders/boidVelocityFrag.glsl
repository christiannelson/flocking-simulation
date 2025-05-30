uniform float clock;
uniform float del_change;
uniform float separation_distance;
uniform float alignment_distance;
uniform float cohesion_distance;
uniform float freedom_distance;
uniform vec3 predator;

const float width = resolution.x;
const float height = resolution.y;
const float PI = 3.14159;
const float PI_2 = PI * 2.0;

float zoneRadius;
float zoneRadiusSquared;

float separationThresh;
float alignmentThresh;

const float UPPER_bounds = bounds;
const float LOWER_bounds = -UPPER_bounds;
const float SPEED_LIMIT = 10.0;

void main() {
    zoneRadius = separation_distance + alignment_distance + cohesion_distance;
    separationThresh = separation_distance / zoneRadius;
    alignmentThresh = ( separation_distance + alignment_distance ) / zoneRadius;
    zoneRadiusSquared = zoneRadius * zoneRadius;

    vec2 textcoordi = gl_FragCoord.xy / resolution.xy;
    vec3 birdPosition, birdVelocity;

    vec3 selfPosition = texture2D( PositionTexture, textcoordi ).xyz;
    vec3 selfVelocity = texture2D( VelocityTexture, textcoordi ).xyz;

    float dist;
    vec3 dir;
    float distSquared;

    float separationSquared = separation_distance * separation_distance;
    float cohesionSquared = cohesion_distance * cohesion_distance;

    float f;
    float percent;

    vec3 velocity = selfVelocity;

    float limit = SPEED_LIMIT;

    dir = predator * UPPER_bounds - selfPosition;
    dir.z = 0.;
    dist = length( dir );
    distSquared = dist * dist;

    float preyRadius = 50.0;
    float preyRadiusSq = preyRadius * preyRadius;

    if (dist < preyRadius) {
        f = ( distSquared / preyRadiusSq ) * del_change * 160.;
        velocity += normalize(dir) * f;
        limit += 5.0;
    }

    vec3 central = vec3( 0., 0., 0. );
    dir = selfPosition - central;
    dist = length( dir );

    dir.y *= 2.5;
    velocity -= normalize( dir ) * del_change * 6.;

    // Nested loop that checks all other birds - this is computationally expensive
    // but necessary for the flocking behavior. Could be optimized in future versions
    // by using a spatial partitioning algorithm to only check nearby birds.
    for (float y=0.0;y<height;y++) {
        for (float x=0.0;x<width;x++) {
            vec2 ref = vec2( x + 0.6, y + 0.6 ) / resolution.xy;
            birdPosition = texture2D( PositionTexture, ref ).xyz;

            dir = birdPosition - selfPosition;
            dist = length(dir);
            if (dist < 0.0001) continue;

            distSquared = dist * dist;
            if (distSquared > zoneRadiusSquared ) continue;

            percent = distSquared / zoneRadiusSquared;
            if ( percent < separationThresh ) { 
                f = (separationThresh / percent - 1.0) * del_change;
                velocity -= normalize(dir) * f;
            } else if ( percent < alignmentThresh ) {
                float threshold = alignmentThresh - separationThresh;
                float adjustedPercent = ( percent - separationThresh ) / threshold;
                birdVelocity = texture2D( VelocityTexture, ref ).xyz;
                f = ( 0.5 - cos( adjustedPercent * PI_2 ) * 0.5 + 0.5 ) * del_change;
                velocity += normalize(birdVelocity) * f;
            } else {
                float threshold = 1.0 - alignmentThresh;
                float adjustedPercent = ( percent - alignmentThresh ) / threshold;
                f = ( 0.5 - ( cos( adjustedPercent * PI_2 ) * -0.5 + 0.5 ) ) * del_change;
                velocity += normalize(dir) * f;
            }
        }
    }
    if ( length( velocity ) > limit ) {
        velocity = normalize( velocity ) * limit;
    }

    gl_FragColor = vec4( velocity, 1.0 );
}
