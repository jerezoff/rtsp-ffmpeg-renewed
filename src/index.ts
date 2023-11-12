import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'stream';

export interface Listener<T> {
    (event: T): any;
}

/**
* This package represents wrapper around ffmpeg lib
* and spawns process which parsing the output
* You can provide settings to adjust output
*/
export default class RtspFFmpegRenewed extends EventEmitter {
    private cmd: string = 'ffmpeg';
    private ffProcess: ChildProcess | undefined

    private url: string
    private fps: number = 10
    private resolution: string | undefined
    private args: string[]
    private debug: boolean

    private buffs: Buffer[] = []

    /**
    * @param {string} url Is important parameter, fullfill with rtsp stream
    * @param {Object} settings You can adjust settings here
    * @param {number} settings.fps Preffered output fps
    * @param {string} settings.resolution Preffered output resolution
    * @param {string} settings.cmd Custom ffmpeg call e.g. if you got ENOENT error
    * @param {string[]} settings.args Custom args for ffmpeg, provide with ['-flag', 'value'] syntax
    * @param {boolean} settings.debug Enables ffmpeg logging
    */
    constructor(url: string, settings?:
        {
            fps?: number,
            resolution?: string | undefined
            cmd?: string,
            debug?: boolean,
            args?: string[]
        }) {
        super()

        if (settings.cmd) {
            this.cmd = settings.cmd
        }

        if (!url || url.trim() === '') {
            throw new Error('invalid url')
        }

        this.url = url

        if (settings.debug) {
            this.debug = settings.debug
        }

        if (settings.fps) {
            this.fps = settings.fps
        }

        if (settings.resolution) {
            this.resolution = settings.resolution
        }

        if (!settings.args) {
            this.args = []
        } else {
            this.args = settings.args
        }
    }

    private generateArgs() {
        return this.args.concat(
            this.debug ? [] : ['-loglevel', 'quiet'],
            this.resolution ? ['-s', this.resolution] : [],
            [
                '-i', this.url,
                '-r', this.fps.toString()
            ],
            [
                '-f', 'image2',
                '-update', '1',
                '-'
            ]
        )
    }

    public isRunning(): boolean {
        return !!this.ffProcess
    }

    /**
     * Starts ffmpeg process
     * 
     * @returns {void}
     */
    public start(): void {
        this.ffProcess = spawn(this.cmd, this.generateArgs())

        if (!this.ffProcess.stdout || !this.ffProcess.stderr) {
            this.stop();
            throw new Error('Failed to bind to stdout or/and stderr')
        }

        this.ffProcess.stdout.on('data', (data: Buffer) => {
            if (data.length > 1) {
                this.buffs.push(data)
                const offset = data[data.length - 2].toString(16)
                const secondOffset = data[data.length - 1].toString(16)
                if (offset === 'ff' && secondOffset === 'd9') {
                    this.emit('data', Buffer.concat(this.buffs))
                    this.buffs = []
                }
            }
        })

        this.ffProcess.stderr.on('data', (data) => {
            throw new Error(data)
        })

        this.ffProcess.on('close', (code) => {
            if (code === 0) {
                setTimeout(() => {
                    this.start();
                }, 1000)
            } else {
                throw new Error(`Process exited with code ${code}${!this.debug && ", try enable debug setting"}`)
            }
        })

        this.ffProcess.on('error', (err) => {
            if (err.name === 'ENOENT') {
                throw new Error('FFMpeg executable wasn\'t found. Install this package and check FFMpeg.cmd property');
            }
            throw err
        })

        this.emit('start')
    }

    /**
     * Stops ffmpeg process
     * 
     * @returns {void}
     */
    public stop(): void {
        if (this.ffProcess) {
            this.ffProcess.kill()
        }
        delete this.ffProcess
        this.emit('stop')
    }

    /**
    * Restarts ffmpeg process
    * 
    * @returns {void}
    */
    public restart(): void {
        this.stop()
        this.start()
        this.emit('restart')
    }
}
