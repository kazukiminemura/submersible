// Keep every light in the renderer's light list. Hiding its parent changes
// NUM_POINT_LIGHTS and forces all lit materials to compile new shaders.
export function setSampleCollected(sample,collected) {
  sample.userData.found=collected;
  sample.visible=true;
  sample.traverse(object=>{
    if(object.isMesh)object.visible=!collected;
    if(object.isLight){
      object.userData.sampleIntensity??=object.intensity;
      object.visible=true;
      object.intensity=collected?0:object.userData.sampleIntensity;
    }
  });
}
