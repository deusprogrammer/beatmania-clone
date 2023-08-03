import Phaser from 'phaser';
import beatRed from './assets/beat-red.png';
import beatHit from './assets/beat-hit.png';
import smooooooch from './assets/smooooch.mp3';
import smoooochTiming from './smooooch.timing';

const WINDOW_TIMING = 33;
const Y_ZERO = 1000;

class MyGame extends Phaser.Scene
{
    constructor ()
    {
        super();
        this.song = null;
        this.controls = null;
        this.hitCount = 0;
        this.hitCountText = null;
        this.beatLines = [];
        this.beatBackgrounds = [];
        this.beatLineIsPressed = [
            false,
            false,
            false,
            false
        ];
        this.timeStarted = null;
        this.mode = 'paused';
        this.beats = [
            [],
            [],
            [],
            []
        ];
        this.beatSprites = [];
        this.nextBeats = [
            {},
            {},
            {},
            {}
        ]
        this.nextBeatsIndex = [
            0,
            0,
            0,
            0
        ]
    }

    preload ()
    {
        this.load.image('beat-red', beatRed);
        this.load.image('beat-hit', beatHit);
        this.load.audio('smooooooch', smooooooch);
    }
      
    create ()
    {
        this.controls = {
            beat1: this.input.keyboard.addKey('A'),
            beat2: this.input.keyboard.addKey('S'),
            beat3: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SEMICOLON),
            beat4: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.QUOTES),
            play: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            record: this.input.keyboard.addKey('R'),
            dump: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
        };

        // Hit count text
        this.hitCountText = this.add.text(600, 20, `${this.hitCount}/121`, {color: "white"});

        // Setup columns
        for (let i = 0; i < 5; i++) {
            if (i < 4) {
                this.add.line(64, 0, i * 128, Y_ZERO, (i + 1) * 128, Y_ZERO, 0xffffff, 1.0).setDepth(100);
                this.beatLines.push(this.add.image(64 + i * 128, Y_ZERO, 'beat-hit').setVisible(false).setDepth(200));

                const graphics = this.add.graphics();
                graphics.fillGradientStyle(0xff0000, 0xff0000, 0xffff00, 0xffff00, 1);
                graphics.fillRect(i * 128, 0, 128, Y_ZERO);
                graphics.setDepth(0);
                graphics.setVisible(false);
                this.beatBackgrounds.push(graphics);
            }
            this.add.line(0, 0, i * 128, 0, i * 128, 3000, 0xffffff, 1.0);
        }

        this.song = this.sound.add('smooooooch');
    }

    update (time, delta)
    {
        // Calculate the time since the song started
        let timeSinceStart = time - this.timeStarted;

        // Reset line color to white
        this.beatLines[0].visible = false;
        this.beatLines[1].visible = false;
        this.beatLines[2].visible = false;
        this.beatLines[3].visible = false;
        this.beatBackgrounds[0].visible = false;
        this.beatBackgrounds[1].visible = false;
        this.beatBackgrounds[2].visible = false;
        this.beatBackgrounds[3].visible = false;

        // Clear beat sprites
        let beatSprite;
        while (beatSprite = this.beatSprites.shift()) {
            beatSprite.destroy();
        }

        if (this.mode === "playing") {
            for (let column = 0; column < 4; column++) {
                // If there are no more beats we can skip this column
                if (this.nextBeatsIndex[column] >= this.beats[column].length) {
                    continue;
                }

                // Draw beats for next second
                let visibleBeats = this.beats[column].filter(({ms}) => ms <= timeSinceStart + 1000);
                visibleBeats.forEach(({ms}) => {
                    let beatSprite = this.add.image(64 + column * 128, 1000 - (ms - timeSinceStart), "beat-red").setDepth(1);
                    this.beatSprites.push(beatSprite);
                })

                // Check to see if there is a hit
                let ms = this.beats[column][this.nextBeatsIndex[column]].ms;
                if (timeSinceStart >= ms - WINDOW_TIMING && timeSinceStart <= ms + WINDOW_TIMING) {
                    this.hitCount++;
                    this.hitCountText.setText(`${this.hitCount}/121`)
                    this.beatBackgrounds[column].visible = true;
                    this.nextBeatsIndex[column]++;
                }
            }
        }

        // Clear beat line states if button released
        if (this.beatLineIsPressed[0] && this.controls.beat1.isUp) {
            this.beatLineIsPressed[0] = false;
        }
        if (this.beatLineIsPressed[1] && this.controls.beat2.isUp) {
            this.beatLineIsPressed[1] = false;
        }
        if (this.beatLineIsPressed[2] && this.controls.beat3.isUp) {
            this.beatLineIsPressed[2] = false;
        }
        if (this.beatLineIsPressed[3] && this.controls.beat4.isUp) {
            this.beatLineIsPressed[3] = false;
        }

        // Handle button press
        if (this.controls.beat1.isDown) {
            this.beatLines[0].visible = true;
            if (this.mode === "recording" && !this.beatLineIsPressed[0]) {
                this.beats[0].push({
                    ms: timeSinceStart
                });
            }
            this.beatLineIsPressed[0] = true;
        }
        if (this.controls.beat2.isDown) {
            this.beatLines[1].visible = true;
            if (this.mode === "recording" && !this.beatLineIsPressed[1]) {
                this.beats[1].push({
                    ms: timeSinceStart
                });
            }
            this.beatLineIsPressed[1] = true;
        }
        if (this.controls.beat3.isDown) {
            this.beatLines[2].visible = true;
            if (this.mode === "recording" && !this.beatLineIsPressed[2]) {
                this.beats[2].push({
                    ms: timeSinceStart
                });
            }
            this.beatLineIsPressed[2] = true;
        }
        if (this.controls.beat4.isDown) {
            this.beatLines[3].visible = true;
            if (this.mode === "recording" && !this.beatLineIsPressed[3]) {
                this.beats[3].push({
                    ms: timeSinceStart
                });
            }
            this.beatLineIsPressed[3] = true;
        }

        // Handle state changing buttons
        if (this.controls.record.isDown) {
            this.mode = 'recording';
            this.timeStarted = time;
            this.song.play();
        } else if (this.controls.play.isDown) {
            this.mode = 'playing';
            this.beats = smoooochTiming;
            this.timeStarted = time;
            this.song.play();
        } else if (this.controls.dump.isDown) {
            this.mode === 'paused';
            this.song.stop();
            console.log("export default " + JSON.stringify(this.beats, null, 5));
        }
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 1920,
    height: 1080,
    scene: MyGame,
    fps: {
        forceSetTimeOut: true,
        smoothStep: false,
        target: 60
    },
};

const game = new Phaser.Game(config);
