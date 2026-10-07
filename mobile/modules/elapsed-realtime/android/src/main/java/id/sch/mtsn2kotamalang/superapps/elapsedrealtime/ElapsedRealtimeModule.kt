package id.sch.mtsn2kotamalang.superapps.elapsedrealtime

import android.os.SystemClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Jam monoton perangkat (milidetik sejak boot, termasuk saat tidur). Tidak terpengaruh perubahan
 * jam dinding oleh pengguna — dipakai sebagai bukti waktu jurnal offline.
 */
class ElapsedRealtimeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ElapsedRealtime")

    Function("elapsedRealtimeMs") {
      SystemClock.elapsedRealtime().toDouble()
    }
  }
}
