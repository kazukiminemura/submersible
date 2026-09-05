"""Run with Blender --background --python blender/build_realistic.py."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name,color,metal=0,rough=.4,emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Metallic'].default_value=metal
    bsdf.inputs['Roughness'].default_value=rough
    if emission:
        bsdf.inputs['Emission Color'].default_value=(*color,1)
        bsdf.inputs['Emission Strength'].default_value=emission
    return m

paint=material('Ochre enamel',(.78,.38,.035),.55,.32)
steel=material('Brushed titanium',(.32,.39,.42),.8,.27)
black=material('Rubber and graphite',(.018,.027,.03),.25,.6)
glass=material('Optical blue glass',(.025,.15,.19),.72,.12)
lamp=material('LED ceramic',(.7,.92,1),.1,.2,5)
red=material('Port navigation',(1,.025,.008),.1,.2,3)
green=material('Starboard navigation',(.02,1,.32),.1,.2,3)

def finish(obj,name,mat):
    obj.name=name; obj.data.materials.append(mat)
    for face in obj.data.polygons: face.use_smooth=True
    return obj

def sphere(name,pos,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=20,location=pos)
    obj=bpy.context.object; obj.scale=scale
    return finish(obj,name,mat)

def box(name,pos,scale,mat,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    obj=bpy.context.object; obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=obj.modifiers.new('Machined edges','BEVEL'); mod.width=bevel; mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj,name,mat)

def tube(name,a,b,radius,mat):
    delta=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=radius,depth=delta.length,location=(Vector(a)+Vector(b))/2)
    obj=bpy.context.object; obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return finish(obj,name,mat)

def ring(name,pos,radius,thickness,mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=10,location=pos,major_radius=radius,minor_radius=thickness,rotation=(math.pi/2,0,0))
    return finish(bpy.context.object,name,mat)

# Blender +Y is bow; glTF exports it as -Z, with +Y up.
sphere('Pressure hull',(0,0,0),(.82,1.8,.73),paint)
sphere('Forward observation dome',(0,1.48,0),(.59,.57,.53),glass)
ring('Dome collar',(0,1.43,0),.58,.065,steel)
for i in range(16):
    a=i*math.tau/16
    sphere('Collar bolt',(.59*math.cos(a),1.49,.59*math.sin(a)),(.032,.03,.032),steel)
for y in [-1.05,-.6,.35]:
    band=ring('Reinforcement',(0,y,0),.73,.025,steel); band.scale.x=1.09
box('Equipment housing',(0,-.35,.72),(.55,1.5,.28),paint)
sphere('Hatch',(0,-.2,.88),(.37,.42,.065),steel)
tube('Antenna',(0,-.65,.88),(0,-.65,1.36),.024,black)
for x in [-1,1]:
    tube('Landing skid',(x,-1.35,-1),(x,1.25,-1),.065,steel)
    for y in [-.9,.85]: tube('Landing strut',(x*.62,y,-.45),(x,y,-1),.05,steel)
    tube('Thruster arm',(x*.65,-.8,-.1),(x*1.2,-.8,-.1),.09,steel)
    for y in [-1.08,-.63]: ring('Duct rim',(x*1.22,y,-.12),.32,.065,black)
    tube('Thruster motor',(x*1.22,-1.12,-.12),(x*1.22,-.58,-.12),.12,steel)
    for i in range(5):
        blade=box('Propeller',(x*1.22,-1.13,-.12),(.5,.035,.075),steel,.02)
        blade.rotation_euler.y=i*math.tau/5
    tube('Lamp housing',(x*.7,1.08,-.35),(x*.7,1.37,-.35),.145,black)
    sphere('LED lens',(x*.7,1.4,-.35),(.115,.03,.115),lamp)
    sphere('Navigation light',(x*.88,-.15,.25),(.055,.07,.055),red if x<0 else green)
    tube('Manipulator upper',(x*.48,.65,-.6),(x*.52,1.3,-.84),.045,steel)
    tube('Manipulator forearm',(x*.52,1.3,-.84),(x*.36,1.76,-.72),.035,steel)
    sphere('Manipulator joint',(x*.52,1.3,-.84),(.075,.075,.075),black)
    for offset in [-.09,.09]: tube('Gripper',(x*.36,1.76,-.72),(x*.36+offset,1.95,-.69),.022,steel)

out=ROOT/'public'/'models'; out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender'/'abyssal_scout.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'submersible.glb'),export_format='GLB',export_apply=True)
print('SCOUT_EXPORT_COMPLETE')
