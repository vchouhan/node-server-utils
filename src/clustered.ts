import * as cluster from 'cluster'
import * as os from 'os'
import { ILogger, logger, LogLevel, setLogger } from './logger'
import { initializeProcess } from './process'
import { workerLogger } from './worker-logger'

export function startCluster(startApp: () => Promise<any>, shutdownApp: () => Promise<any>, useLogger?: ILogger) {
    if (useLogger != undefined) {
        if (cluster.isMaster) {
            setLogger(useLogger)
        } else {
            setLogger(workerLogger)
        }
    }

    if (cluster.isMaster) {
        initializeProcess(async () => {
            cluster.disconnect()
        }, logger)

        let workerCount = os.cpus().length
        if (process.env.MAX_WORKERS != undefined) {
            const clusterMaxWorkerCount: number = Number(process.env.MAX_WORKERS)
            if (!isNaN(clusterMaxWorkerCount)) {
                workerCount = Math.min(clusterMaxWorkerCount, workerCount)
            }
        }

        cluster.on('exit', (deadWorker, code, signal) => {
            if (!deadWorker.exitedAfterDisconnect) {
                logger.error({ message: `cluster worker crash`, code })
            } else {
                logger.silly({ message: `cluster worker exit`, code })
            }
        })

        for (let i = 0; i < workerCount; i += 1) {
            const worker = cluster.fork()
            worker.on('message', message => {
                switch (message.level as LogLevel) {
                    case LogLevel.Silly:
                        logger.silly(message)
                        break
                    case LogLevel.Debug:
                        logger.debug(message)
                        break
                    case LogLevel.Info:
                        logger.info(message)
                        break
                    case LogLevel.Warn:
                        logger.warn(message)
                        break
                    case LogLevel.Error:
                        logger.error(message)
                        break
                }
            })
        }
    } else {
        initializeProcess(shutdownApp, logger)
        return startApp()
    }
}
