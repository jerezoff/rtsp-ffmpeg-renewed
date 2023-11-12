import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'stream';

export interface Listener<T> {
    (event: T): any;
}

/**
* This package represents wrapper around ffmpeg lib
* and spawns process which parsing the output
* You can provide settings to adjust output
* 
* @param url Is important parameter, fullfill with rtsp stream
* @param settings You can adjust settings here
* @param settings.fps Preffered output fps
* @param settings.resolution Preffered output resolution
* @param settings.cmd Custom ffmpeg call e.g. if you got ENOENT error
* @param settings.args Custom args for ffmpeg, provide with ['-flag', 'value'] syntax
*/
export default class RtspFFmpegRenewed extends EventEmitter {
    private cmd: string = 'ffmpeg';
    private ffProcess: ChildProcess | undefined
    private args: string[]
    private url: string
    private fps: number = 10
    private buffs: Buffer[] = []
    private resolution: string | undefined

    constructor(url: string, settings?:
        {
            fps?: number,
            resolution?: string | undefined
            cmd?: string,
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
            this.args,
            [
                '-loglevel', 'quiet',
                '-i', this.url,
                '-r', this.fps.toString()
            ],
            this.resolution ? ['-s', this.resolution] : [],
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
            }
        })

        this.ffProcess.on('error', (err) => {
            if (err.name === 'ENOENT') {
                throw new Error('FFMpeg executable wasn\'t found. Install this package and check FFMpeg.cmd property');
            }
            throw err
        })

        this.emit('started')
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
        this.emit('stopped')
    }

    /**
    * Restarts ffmpeg process
    * 
    * @returns {void}
    */
    public restart(): void {
        this.stop()
        this.start()
        this.emit('restarted')
    }
}