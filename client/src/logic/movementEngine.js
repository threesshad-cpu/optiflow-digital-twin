// Function to update AGV state with motion penalties
const updateMotionMetrics = (agv, isTurning, isStopping) => {
    let msiPenalty = 0;
    let timePenalty = 1000; // Base 1s per cell

    if (isTurning) {
        msiPenalty += 15;   // High stress on gearbox during pivots
        timePenalty += 500; // 0.5s delay for turning
    }
    
    if (isStopping) {
        msiPenalty += 10;   // Torque spike during hard stops
        timePenalty += 300; // Delay for deceleration
    }

    // Update the AGV object
    return {
        ...agv,
        msi: (agv.msi || 0) + msiPenalty,
        travelTime: timePenalty
    };
};