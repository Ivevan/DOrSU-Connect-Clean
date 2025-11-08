import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from './logger.js';

const execAsync = promisify(exec);

export class GPUMonitor {
  static instance = null;

  constructor() {
    this.cudaAvailable = false;
    this.monitoringInterval = null;
  }

  static getInstance() {
    if (!GPUMonitor.instance) {
      GPUMonitor.instance = new GPUMonitor();
    }
    return GPUMonitor.instance;
  }

  async checkCUDA() {
    try {
      // Check if nvidia-smi is available
      await execAsync('nvidia-smi --version');
      this.cudaAvailable = true;
      Logger.success('CUDA detected via nvidia-smi');
      return true;
    } catch (error) {
      Logger.warn('CUDA not detected - nvidia-smi not available');
      this.cudaAvailable = false;
      return false;
    }
  }

  async getGPUInfo() {
    if (!this.cudaAvailable) {
      return [];
    }

    try {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw,power.limit --format=csv,noheader,nounits');
      const lines = stdout.trim().split('\n');
      
      return lines.map(line => {
        const [name, memoryTotal, memoryUsed, utilization, temperature, powerDraw, powerLimit] = line.split(', ');
        return {
          name: name?.trim() || 'Unknown',
          memory: `${memoryUsed?.trim() || '0'}/${memoryTotal?.trim() || '0'} MB`,
          utilization: `${utilization?.trim() || '0'}%`,
          temperature: `${temperature?.trim() || '0'}°C`,
          power: `${powerDraw?.trim() || '0'}/${powerLimit?.trim() || '0'} W`
        };
      });
    } catch (error) {
      Logger.error('Failed to get GPU info', error);
      return [];
    }
  }

  async getOptimalGPULayers() {
    if (!this.cudaAvailable) {
      return 0;
    }

    try {
      const gpuInfo = await this.getGPUInfo();
      if (gpuInfo.length === 0) {
        return 0;
      }

      // Parse memory info to determine optimal layers
      const memoryInfo = gpuInfo[0]?.memory || '0/0 MB';
      const [used, totalStr] = memoryInfo.split('/');
      const total = parseInt(totalStr?.trim() || '0') || 0;
      
      // For Gemma 3:4b (~2.5GB), recommend layers based on available VRAM
      if (total >= 4000) {
        return 30; // Use most layers for 4GB+ VRAM
      } else if (total >= 3000) {
        return 25; // Moderate layers for 3GB VRAM
      } else if (total >= 2000) {
        return 20; // Fewer layers for 2GB VRAM
      } else {
        return 0; // Use CPU only for <2GB VRAM
      }
    } catch (error) {
      Logger.error('Failed to calculate optimal GPU layers', error);
      return 0;
    }
  }

  startMonitoring(intervalMs = 60000) {
    if (!this.cudaAvailable) {
      return;
    }

    this.stopMonitoring();
    
    // Show initial GPU status only
    this.displayGPUStatus();
    
    // Don't continue monitoring at intervals to avoid slowing down the process
    // Only show GPU status when explicitly requested

    Logger.success(`GPU monitoring initialized (no automatic updates)`);
  }

  async displayGPUStatus() {
    try {
      const gpuInfo = await this.getGPUInfo();
      if (gpuInfo.length > 0) {
        const gpu = gpuInfo[0];
        console.log('\n' + '='.repeat(70));
        console.log('🖥️  GPU STATUS');
        console.log('='.repeat(70));
        console.log(`📌 GPU: ${gpu.name}`);
        console.log(`💾 Memory: ${gpu.memory}`);
        console.log(`⚡ Utilization: ${gpu.utilization}`);
        console.log(`🌡️  Temperature: ${gpu.temperature}`);
        console.log(`🔌 Power: ${gpu.power}`);
        console.log('='.repeat(70) + '\n');
      }
    } catch (error) {
      Logger.error('GPU monitoring error', error);
    }
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      Logger.info('GPU monitoring stopped');
    }
  }

  isCUDAAvailable() {
    return this.cudaAvailable;
  }
}
