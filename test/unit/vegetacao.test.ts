import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DIVINO } from '@/core/palette.ts';
import { leafMat } from '../../src/assets/models/divinolandia/copa.ts';
import { makeCoffee, makeTrees } from '../../src/assets/models/divinolandia/vegetacao.ts';

describe('vegetation instancing', () => {
  it('draws all broadleaf tones together while preserving their linear albedo and transforms', () => {
    const trees = Array.from({ length: 34 }, (_, i) => ({ x: i * 3, y: i / 4, z: -i, s: .7 + i / 100, r: i / 7 }));
    const groups = makeTrees(trees);
    expect(groups).toHaveLength(1);
    const meshes = groups[0].children as THREE.InstancedMesh[];
    // Broadleaf trunk + crown, eucalyptus trunk + crown; palette size adds no draws.
    expect(meshes).toHaveLength(4);
    const crowns = meshes.filter(m => m.instanceColor);
    expect(crowns).toHaveLength(1);
    const crown = crowns[0];
    const broad = trees.filter((_, i) => i % 11 !== 0);
    expect(crown.count).toBe(broad.length);
    expect(crown.castShadow).toBe(true);
    expect(crown.receiveShadow).toBe(false);
    expect(crown.matrixAutoUpdate).toBe(false);
    expect(crown.boundingSphere?.radius).toBeGreaterThan(0);
    const matrix = new THREE.Matrix4(), colour = new THREE.Color();
    const material = crown.material as THREE.MeshLambertMaterial;
    broad.forEach((tree, i) => {
      crown.getMatrixAt(i, matrix);
      const expected = new THREE.Matrix4().compose(
        new THREE.Vector3(tree.x, tree.y, tree.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.r),
        new THREE.Vector3(tree.s, tree.s, tree.s),
      );
      matrix.elements.forEach((v, j) => expect(v).toBeCloseTo(expected.elements[j], 5));
      crown.getColorAt(i, colour);
      colour.multiply(material.color);
      const former = leafMat(DIVINO.tree[i % DIVINO.tree.length]);
      expect(colour.r).toBeCloseTo(former.color.r, 6);
      expect(colour.g).toBeCloseTo(former.color.g, 6);
      expect(colour.b).toBeCloseTo(former.color.b, 6);
      // Compare texture identity in browsers; node tests use blank canvas substitutes.
      expect(material.map?.colorSpace).toBe(former.map?.colorSpace);
    });
    expect(meshes.filter(m => !m.instanceColor).map(m => m.count)).toEqual([broad.length, 4, 4]);
  });

  it('keeps spatial chunks independent and restarts their original palette distribution', () => {
    const groups = makeTrees(Array.from({ length: 26 }, (_, i) => ({ x: (i < 13 ? -400 : 400) + i, y: 0, z: 0, s: 1, r: 0 })));
    expect(groups.map(g => g.userData.cx)).toEqual([-400, 400]);
    for (const group of groups) {
      const crown = (group.children as THREE.InstancedMesh[]).find(m => m.instanceColor)!;
      expect(crown.count).toBe(11);
      const colour = new THREE.Color(); crown.getColorAt(0, colour);
      const expected = new THREE.Color(DIVINO.tree[0]);
      expect(colour.r).toBeCloseTo(expected.r, 6);
      expect(colour.g).toBeCloseTo(expected.g, 6);
      expect(colour.b).toBeCloseTo(expected.b, 6);
    }
  });

  it('retains three separately positioned coffee hedges per row without tree colouring', () => {
    const groups = makeCoffee([{ x: 20, y: 2, z: 40, s: 1.2, r: Math.PI / 2 }]);
    expect(groups).toHaveLength(1);
    const mesh = groups[0].children[0] as THREE.InstancedMesh;
    expect(mesh.count).toBe(3);
    expect(mesh.instanceColor).toBeNull();
    expect(mesh.castShadow).toBe(false);
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3();
    for (const [i, x] of [23.4, 20, 16.6].entries()) {
      mesh.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
      expect(position.x).toBeCloseTo(x, 5);
      expect(position.y).toBe(2);
      expect(position.z).toBe(40);
    }
  });
});
