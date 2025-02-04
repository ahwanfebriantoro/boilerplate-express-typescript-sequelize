import ConstRole from '@expresso/constants/ConstRole'
import asyncHandler from '@expresso/helpers/asyncHandler'
import { deleteFile } from '@expresso/helpers/File'
import { arrayFormatter } from '@expresso/helpers/Formatter'
import useMulter from '@expresso/hooks/useMulter'
import { FileAttributes } from '@expresso/interfaces/Files'
import HttpResponse from '@expresso/modules/Response/HttpResponse'
import ResponseError from '@expresso/modules/Response/ResponseError'
import Authorization from '@middlewares/Authorization'
import PermissionAccess from '@middlewares/PermissionAccess'
import route from '@routes/v1'
import { NextFunction, Request, Response } from 'express'
import _ from 'lodash'
import UploadService from './service'

route.get(
  '/upload',
  Authorization,
  asyncHandler(async function findAll(req: Request, res: Response) {
    const data = await UploadService.findAll(req)

    const httpResponse = HttpResponse.get(data)
    res.status(200).json(httpResponse)
  })
)

route.get(
  '/upload/:id',
  Authorization,
  asyncHandler(async function findById(req: Request, res: Response) {
    const { id } = req.getParams()
    const data = await UploadService.findById(id)

    const httpResponse = HttpResponse.get({ data })
    res.status(200).json(httpResponse)
  })
)

route.post(
  '/upload/s3/presign-url',
  Authorization,
  asyncHandler(async function findById(req: Request, res: Response) {
    const { keyFile } = req.getBody()

    // Signed URL to S3 Bucket
    const signedUrl = await UploadService.getSignedUrlS3(keyFile)

    const httpResponse = HttpResponse.get({ data: signedUrl })
    res.status(200).json(httpResponse)
  })
)

route.post(
  '/upload/gcs/presign-url',
  Authorization,
  asyncHandler(async function findById(req: Request, res: Response) {
    const { keyFile } = req.getBody()

    // Signed URL to GCS Bucket
    const signedUrl = await UploadService.getSignedUrlGCS(keyFile)

    const httpResponse = HttpResponse.get({ data: signedUrl })
    res.status(200).json(httpResponse)
  })
)

const uploadFile = useMulter({
  dest: 'public/uploads/temp',
}).fields([{ name: 'fileUpload', maxCount: 1 }])

const setFileToBody = asyncHandler(async function setFileToBody(
  req: Request,
  res,
  next: NextFunction
) {
  const fileUpload = req.pickSingleFieldMulter(['fileUpload'])

  req.setBody(fileUpload)
  next()
})

route.post(
  '/upload',
  Authorization,
  uploadFile,
  setFileToBody,
  asyncHandler(async function create(req: Request, res: Response) {
    const formData = req.getBody()

    const fieldUpload = _.get(formData, 'fileUpload', {}) as FileAttributes

    let aws_s3_data
    let gcs_data
    let upload_data

    // Upload to AWS S3
    if (!_.isEmpty(fieldUpload) && !_.isEmpty(fieldUpload.path)) {
      const directory = formData.type ?? 'uploads'

      if (_.isEmpty(formData.provider)) {
        throw new ResponseError.BadRequest('please choose upload provider')
      }

      // Upload to AWS S3
      if (formData.provider === 's3') {
        const resUpload = await UploadService.uploadFileS3WithSignedUrl({
          fieldUpload,
          directory,
        })

        aws_s3_data = resUpload.aws_s3_data
        upload_data = resUpload.upload_data
      }

      // Upload to Google Cloud Storage
      if (formData.provider === 'gcs') {
        const resUpload = await UploadService.uploadFileGCSWithSignedUrl({
          fieldUpload,
          directory,
        })

        gcs_data = resUpload.gcs_data
        upload_data = resUpload.upload_data
      }

      deleteFile(fieldUpload.path)
    }

    const httpResponse = HttpResponse.created({
      data: upload_data,
      s3: aws_s3_data,
      gcs: gcs_data,
    })
    res.status(201).json(httpResponse)
  })
)

route.put(
  '/upload/:id',
  Authorization,
  uploadFile,
  setFileToBody,
  asyncHandler(async function update(req: Request, res: Response) {
    const { id } = req.getParams()
    const formData = req.getBody()

    const fieldUpload = _.get(formData, 'fileUpload', {}) as FileAttributes

    let aws_s3_data
    let gcs_data
    let upload_data

    // Upload to AWS S3
    if (!_.isEmpty(fieldUpload) && !_.isEmpty(fieldUpload.path)) {
      const directory = formData.type ?? 'uploads'

      if (_.isEmpty(formData.provider)) {
        throw new ResponseError.BadRequest('please choose upload provider')
      }

      // Upload to AWS S3
      if (formData.provider === 's3') {
        const resUpload = await UploadService.uploadFileS3WithSignedUrl({
          fieldUpload,
          directory,
          UploadId: id,
        })

        aws_s3_data = resUpload.aws_s3_data
        upload_data = resUpload.upload_data
      }

      // Upload to Google Cloud Storage
      if (formData.provider === 'gcs') {
        const resUpload = await UploadService.uploadFileGCSWithSignedUrl({
          fieldUpload,
          directory,
          UploadId: id,
        })

        gcs_data = resUpload.gcs_data
        upload_data = resUpload.upload_data
      }

      deleteFile(fieldUpload.path)
    } else {
      // get upload file
      const getUpload = await UploadService.findById(id)

      upload_data = getUpload
    }

    const httpResponse = HttpResponse.updated({
      data: upload_data,
      s3: aws_s3_data,
      gcs: gcs_data,
    })
    res.status(200).json(httpResponse)
  })
)

route.put(
  '/upload/restore/:id',
  Authorization,
  PermissionAccess(ConstRole.ROLE_ADMIN),
  asyncHandler(async function restore(req: Request, res: Response) {
    const { id } = req.getParams()

    await UploadService.restore(id)

    const httpResponse = HttpResponse.updated({})
    res.status(200).json(httpResponse)
  })
)

route.delete(
  '/upload/soft-delete/:id',
  Authorization,
  PermissionAccess(ConstRole.ROLE_ADMIN),
  asyncHandler(async function softDelete(req: Request, res: Response) {
    const { id } = req.getParams()

    await UploadService.softDelete(id)

    const httpResponse = HttpResponse.deleted({})
    res.status(200).json(httpResponse)
  })
)

route.delete(
  '/upload/force-delete/:id',
  Authorization,
  PermissionAccess(ConstRole.ROLE_ADMIN),
  asyncHandler(async function forceDelete(req: Request, res: Response) {
    const { id } = req.getParams()

    await UploadService.forceDelete(id)

    const httpResponse = HttpResponse.deleted({})
    res.status(200).json(httpResponse)
  })
)

route.post(
  '/upload/multiple/restore',
  Authorization,
  PermissionAccess(ConstRole.ROLE_ADMIN),
  asyncHandler(async function multipleRestore(req: Request, res: Response) {
    const formData = req.getBody()
    const arrayIds = arrayFormatter(formData.ids)

    await UploadService.multipleRestore(arrayIds)

    const httpResponse = HttpResponse.updated({})
    res.status(200).json(httpResponse)
  })
)

route.post(
  '/upload/multiple/soft-delete',
  Authorization,
  PermissionAccess(ConstRole.ROLE_ADMIN),
  asyncHandler(async function multipleSoftDelete(req: Request, res: Response) {
    const formData = req.getBody()
    const arrayIds = arrayFormatter(formData.ids)

    await UploadService.multipleSoftDelete(arrayIds)

    const httpResponse = HttpResponse.deleted({})
    res.status(200).json(httpResponse)
  })
)

route.post(
  '/upload/multiple/force-delete',
  Authorization,
  PermissionAccess(ConstRole.ROLE_ADMIN),
  asyncHandler(async function multipleForceDelete(req: Request, res: Response) {
    const formData = req.getBody()
    const arrayIds = arrayFormatter(formData.ids)

    await UploadService.multipleForceDelete(arrayIds)

    const httpResponse = HttpResponse.deleted({})
    res.status(200).json(httpResponse)
  })
)
