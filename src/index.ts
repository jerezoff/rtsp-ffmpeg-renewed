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
    private quality: number
    private format: string
    private outPath: string

    private args: string[]
    private debug: boolean

    private buffs: Buffer[] = []

    /**
    * @param {string} url Is important parameter, fullfill with rtsp stream
    * @param {Object} settings You can adjust settings here
    * @param {number} settings.fps Preffered output fps
    * @param {number} settings.quality Quality of the stream
    * @param {string} settings.outPath Path for the output
    * @param {string} settings.resolution Preffered output resolution
    * @param {string} settings.cmd Custom ffmpeg call e.g. if you got ENOENT error
    * @param {string[]} settings.args Custom args for ffmpeg, provide with ['-flag', 'value'] syntax
    * @param {boolean} settings.debug Enables ffmpeg logging
    */
    constructor(url: string, settings?:
        {
            fps?: number,
            quality?: number,
            resolution?: string | undefined
            cmd?: string,
            debug?: boolean,
            format?: string,
            outPath?: string
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

        if(settings.format) {
            this.format = settings.format
        } else {
            this.format = 'image2'
        }

        if (settings.resolution) {
            this.resolution = settings.resolution
        }

        if(settings.outPath) {
            this.outPath = settings.outPath
        } else {
            this.outPath = '-'
        }

        if(settings.quality) {
           this.quality = settings.quality 
        }

        if (!settings.args) {
            this.args = []
        } else {
            this.args = settings.args
        }
    }

    private generateArgs() {
        return [].concat(
            [
                '-i', this.url,
                '-r', this.fps.toString()
            ],
            this.debug ? [] : ['-loglevel', 'quiet'],
            this.resolution ? ['-s', this.resolution] : [],
            this.quality ? ['-q:v', this.quality.toString()] : [],
            ['-f', this.format],
            this.args,
            [
                '-update', '1',
                this.outPath
            ]
        )
    }

    /**
     * Shows status of the ffmpeg process
     * @returns {boolean}
     */
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
            throw new Error(`${data} arguments: "${this.generateArgs()}"`)
        })

        this.ffProcess.on('close', (code) => {
            if (code === 0) {
                setTimeout(() => {
                    this.start();
                }, 1000)
            } else {
                throw new Error(`Process exited with code ${code}${!this.debug && ", try enable debug setting"} arguments: "${this.generateArgs()}"`)
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
