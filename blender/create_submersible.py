"""Blender 4.x: run from Scripting workspace to generate the playable game's submersible asset."""
import bpy

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0.0, roughness=.5):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1)
    m.metallic=metallic; m.roughness=roughness
    return m

yellow=material('Scout Yellow',(.78,.49,.05),.7,.25)
dark=material('Frame',(.015,.04,.06),.65,.3)
glass=material('Viewport',(.08,.55,.7),.15,.08)

def uv(name, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(mat); bpy.ops.object.shade_smooth(); return o
body=uv('Hull',(0,0,0),(1.45,.72,.74),yellow)
window=uv('Glass dome',(.6,-.48,.12),(.62,.16,.5),glass)
bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=.32, radius2=.2, depth=.65, location=(-1.7,0,0), rotation=(0,-1.5708,0)); bpy.context.object.data.materials.append(dark)
for z in (-.88,.88):
    bpy.ops.mesh.primitive_cube_add(location=(-.3,0,z), scale=(.48,.06,.23)); bpy.context.object.data.materials.append(dark)
bpy.context.scene.world.color=(.005,.018,.03)
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//abyssal_scout_submersible.blend'))
print('Created abyssal_scout_submersible.blend')
